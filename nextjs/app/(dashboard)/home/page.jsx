'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';
import { SERVICES } from '@/lib/ui/app/serviceRegistry';

export default function ServiceHubPage() {
  const [access, setAccess] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiClient
      .get('/api/services/access')
      .then((response) => {
        if (active) setAccess(response?.data?.data || {});
      })
      .catch(() => {
        if (active) setAccess({});
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(
    () =>
      SERVICES.map((service) => {
        const entitlement = access?.[service.slug];
        const released = service.status === 'active' || service.status === 'beta';
        const enabled = released && entitlement?.enabled === true;
        const label = !released
          ? 'Coming soon'
          : enabled
            ? service.status === 'beta'
              ? 'Beta · Available'
              : 'Available'
            : 'Not included';
        return { service, entitlement, enabled, label };
      }),
    [access]
  );

  return (
    <PageBody
      title="Your business tools"
      description="Every product is visible here. You can open only the services enabled for your business or user account."
    >
      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Checking your services…</Typography>
        </Stack>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
            xl: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 2,
        }}
      >
        {cards.map(({ service, entitlement, enabled, label }) => {
          const Icon = service.icon;
          const cardContent = (
            <Stack spacing={2} sx={{ height: '100%' }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2.5,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'action.hover',
                    color: enabled ? 'text.primary' : 'text.secondary',
                  }}
                >
                  <Icon fontSize="medium" />
                </Box>
                <Chip
                  size="small"
                  icon={!enabled && service.status !== 'planned' ? <LockRoundedIcon /> : undefined}
                  label={label}
                  color={enabled ? 'success' : 'default'}
                  variant={enabled ? 'filled' : 'outlined'}
                />
              </Stack>

              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  {service.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {service.description}
                </Typography>
              </Box>

              <Typography variant="body2" fontWeight={650} color={enabled ? 'primary.main' : 'text.secondary'}>
                {enabled
                  ? 'Open dashboard →'
                  : service.status === 'planned'
                    ? 'Coming soon'
                    : entitlement?.reason || 'Upgrade or ask your admin for access'}
              </Typography>
            </Stack>
          );

          return (
            <Card key={service.slug} variant="outlined" sx={{ height: '100%', borderRadius: 3 }}>
              {enabled ? (
                <CardActionArea component={NextLink} href={service.href} sx={{ height: '100%', p: 2.5, alignItems: 'stretch' }}>
                  {cardContent}
                </CardActionArea>
              ) : (
                <Box sx={{ height: '100%', p: 2.5, opacity: loading ? 0.65 : 1 }} aria-disabled="true">
                  {cardContent}
                </Box>
              )}
            </Card>
          );
        })}
      </Box>
    </PageBody>
  );
}
