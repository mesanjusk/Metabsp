'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import CurrencyRupeeRoundedIcon from '@mui/icons-material/CurrencyRupeeRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';
import { INSTITUTE_FEATURE_GROUPS } from '@/lib/institute/featureRegistry';

const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function Stat({ icon: Icon, label, value, money = false }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, minWidth: 0 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
          <Typography variant="h5" fontWeight={800} noWrap>
            {money ? `₹${number.format(Number(value || 0))}` : number.format(Number(value || 0))}
          </Typography>
        </Box>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon fontSize="small" />
        </Box>
      </Stack>
    </Paper>
  );
}

export default function InstituteHomePage() {
  const [overview, setOverview] = useState({ kpis: {}, recent: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiClient
      .get('/api/institute/overview')
      .then((response) => {
        if (active) setOverview(response?.data?.data || { kpis: {}, recent: [] });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const k = overview?.kpis || {};

  return (
    <PageBody
      title="Institute Management"
      description="Admissions, academics, fees, attendance, accounts, staff, forms and institute tools in one workspace."
    >
      <Stack spacing={3}>
        {loading ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">Loading institute overview…</Typography>
          </Stack>
        ) : null}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', sm: 'repeat(4, minmax(0,1fr))', xl: 'repeat(8, minmax(0,1fr))' }, gap: 1.5 }}>
          <Stat icon={PeopleAltRoundedIcon} label="Students" value={k.students} />
          <Stat icon={PersonAddAltRoundedIcon} label="Leads" value={k.leads} />
          <Stat icon={SchoolRoundedIcon} label="Admissions" value={k.admissions} />
          <Stat icon={MenuBookRoundedIcon} label="Courses" value={k.courses} />
          <Stat icon={GroupsRoundedIcon} label="Batches" value={k.batches} />
          <Stat icon={BadgeRoundedIcon} label="Employees" value={k.employees} />
          <Stat icon={CurrencyRupeeRoundedIcon} label="Collected" value={k.feesCollected} money />
          <Stat icon={CurrencyRupeeRoundedIcon} label="Fee Balance" value={k.feeBalance} money />
        </Box>

        {INSTITUTE_FEATURE_GROUPS.map((group) => (
          <Box key={group.key}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.5} sx={{ mb: 1.25 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>{group.label}</Typography>
                <Typography variant="body2" color="text.secondary">{group.description}</Typography>
              </Box>
              <Chip size="small" label={`${group.features.length} tools`} variant="outlined" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }} />
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', sm: 'repeat(3, minmax(0,1fr))', lg: 'repeat(5, minmax(0,1fr))' }, gap: 1.25 }}>
              {group.features.map((feature) => {
                const Icon = feature.icon;
                const href = feature.href || `/services/institute/${feature.slug}`;
                return (
                  <Card key={feature.slug} variant="outlined" sx={{ borderRadius: 3, minWidth: 0 }}>
                    <CardActionArea component={NextLink} href={href} sx={{ p: 1.7, height: '100%' }}>
                      <Stack spacing={1.15}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: 'action.hover' }}>
                            <Icon fontSize="small" />
                          </Box>
                          {feature.kind === 'shared' ? <Chip size="small" label="Shared" variant="outlined" /> : null}
                        </Stack>
                        <Box>
                          <Typography variant="body2" fontWeight={800}>{feature.label}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35, lineHeight: 1.35 }}>
                            {feature.description}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Box>
          </Box>
        ))}
      </Stack>
    </PageBody>
  );
}
