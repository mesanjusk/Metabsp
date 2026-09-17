'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';
import { SERVICES } from '@/lib/ui/app/serviceRegistry';
import { BUSINESS_TYPES, recommendedServices } from '@/lib/smb/businessProfiles';

const TEAM_SIZES = [
  ['solo', 'Just me'],
  ['2-5', '2–5 people'],
  ['6-20', '6–20 people'],
  ['21-50', '21–50 people'],
  ['50+', '50+ people'],
];

export default function BusinessProfileSetupPage() {
  const router = useRouter();
  const [businessType, setBusinessType] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [teamSize, setTeamSize] = useState('solo');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const suggested = useMemo(() => recommendedServices(businessType || null), [businessType]);
  const visibleServices = useMemo(() => {
    const wanted = new Set([...suggested, ...selected]);
    return SERVICES.filter((service) => wanted.has(service.slug));
  }, [suggested, selected]);

  const chooseType = (value) => {
    setBusinessType(value);
    setSelected(recommendedServices(value));
  };

  const toggleService = (slug) => {
    setSelected((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);
  };

  const save = async () => {
    if (!businessType) return setError('Please select your business type.');
    setSaving(true);
    setError('');
    try {
      await apiClient.put('/api/business-profile', { businessType, businessName, teamSize, selectedServices: selected });
      router.replace('/home');
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save your business profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageBody title="Set up your business workspace" description="Tell us what kind of business you run. We’ll show the tools that matter instead of making every account look the same.">
      <Stack spacing={2.5} sx={{ maxWidth: 920, mx: 'auto' }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Business type</InputLabel>
              <Select value={businessType} label="Business type" onChange={(event) => chooseType(event.target.value)}>
                {BUSINESS_TYPES.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Business name (optional)" value={businessName} onChange={(event) => setBusinessName(event.target.value)} inputProps={{ maxLength: 120 }} />
            <FormControl fullWidth>
              <InputLabel>Team size</InputLabel>
              <Select value={teamSize} label="Team size" onChange={(event) => setTeamSize(event.target.value)}>
                {TEAM_SIZES.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </Card>

        {businessType ? (
          <Box>
            <Typography variant="h6" fontWeight={800} gutterBottom>Recommended tools</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>These are preselected for your business. You can change them now and update them later.</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
              {visibleServices.map((service) => {
                const Icon = service.icon;
                const checked = selected.includes(service.slug);
                return (
                  <Card key={service.slug} variant="outlined" onClick={() => toggleService(service.slug)} sx={{ p: 2, borderRadius: 3, cursor: 'pointer', borderColor: checked ? 'primary.main' : 'divider' }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <Icon color={checked ? 'primary' : 'action'} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography fontWeight={750}>{service.label}</Typography>
                        <Typography variant="body2" color="text.secondary">{service.description}</Typography>
                      </Box>
                      <Checkbox checked={checked} onChange={() => toggleService(service.slug)} onClick={(event) => event.stopPropagation()} />
                    </Stack>
                  </Card>
                );
              })}
            </Box>
          </Box>
        ) : null}

        <Button variant="contained" size="large" disabled={!businessType || saving} onClick={save} sx={{ alignSelf: { xs: 'stretch', sm: 'flex-end' } }}>
          {saving ? 'Saving…' : 'Create my workspace'}
        </Button>
      </Stack>
    </PageBody>
  );
}
