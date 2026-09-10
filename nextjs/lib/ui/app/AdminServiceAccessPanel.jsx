'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import apiClient from '@/lib/api/client';
import { SERVICES } from './serviceRegistry';

export default function AdminServiceAccessPanel() {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [access, setAccess] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/api/users/manage')
      .then((response) => {
        const items = response?.data?.items || [];
        setUsers(items);
        const firstId = String(items?.[0]?.id || items?.[0]?._id || '');
        if (firstId) setUserId(firstId);
      })
      .catch(() => setError('Unable to load users.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!userId) return;
    setError('');
    apiClient.get(`/api/services/access/admin?userId=${encodeURIComponent(userId)}`)
      .then((response) => setAccess(response?.data?.data || {}))
      .catch(() => setError('Unable to load service access for this user.'));
  }, [userId]);

  const selectedUser = useMemo(
    () => users.find((user) => String(user.id || user._id) === String(userId)),
    [users, userId]
  );

  async function setProAccess(service, enabled) {
    setSaving(service.slug);
    setError('');
    try {
      await apiClient.post('/api/services/access', {
        userId,
        service: service.slug,
        enabled,
        source: 'manual',
        note: enabled ? 'Enabled by platform admin' : 'Disabled by platform admin',
      });
      setAccess((current) => ({
        ...current,
        [service.slug]: { ...(current?.[service.slug] || {}), enabled, source: 'user', tier: 'pro' },
      }));
    } catch (_error) {
      setError(`Unable to update ${service.label}.`);
    } finally {
      setSaving('');
    }
  }

  if (loading) return <CircularProgress size={22} />;

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h6" fontWeight={800}>Products & Service Access</Typography>
        <Typography variant="body2" color="text.secondary">
          Basic services are included for every account. Use these controls only for Pro services.
        </Typography>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <FormControl size="small" sx={{ maxWidth: 420 }}>
        <InputLabel id="service-user-label">Customer / user</InputLabel>
        <Select labelId="service-user-label" label="Customer / user" value={userId} onChange={(event) => setUserId(event.target.value)}>
          {users.map((user) => {
            const id = String(user.id || user._id || '');
            const label = user.Display_name || user.name || user.mobile || user.Mobile_number || user.username || id;
            return <MenuItem key={id} value={id}>{label}</MenuItem>;
          })}
        </Select>
      </FormControl>

      {selectedUser ? (
        <Typography variant="caption" color="text.secondary">
          Managing access for {selectedUser.Display_name || selectedUser.name || selectedUser.mobile || selectedUser.username || userId}
        </Typography>
      ) : null}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
        {SERVICES.map((service) => {
          const isBasic = service.tier === 'basic';
          const enabled = isBasic ? true : access?.[service.slug]?.enabled === true;
          return (
            <Paper key={service.slug} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                  <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <service.icon fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <Typography fontWeight={750} noWrap>{service.label}</Typography>
                      <Chip size="small" label={isBasic ? 'BASIC' : 'PRO'} variant={isBasic ? 'outlined' : 'filled'} sx={{ height: 20, fontSize: '0.62rem' }} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {service.status === 'planned' ? 'Coming soon' : isBasic ? 'Included for everyone' : enabled ? 'Enabled' : 'Not enabled'}
                    </Typography>
                  </Box>
                </Stack>

                {isBasic ? (
                  <Chip label="Always on" size="small" color="success" variant="outlined" />
                ) : (
                  <Switch
                    checked={enabled}
                    disabled={!userId || saving === service.slug}
                    onChange={(event) => setProAccess(service, event.target.checked)}
                    inputProps={{ 'aria-label': `Toggle ${service.label}` }}
                  />
                )}
              </Stack>
            </Paper>
          );
        })}
      </Box>
    </Stack>
  );
}
