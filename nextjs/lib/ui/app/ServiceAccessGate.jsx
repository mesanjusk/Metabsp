'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import apiClient from '@/lib/api/client';
import { getActiveServiceInfo } from './navigation';

/**
 * UI entitlement gate for direct URLs.
 *
 * The service hub already disables inaccessible cards, but a user can paste a
 * URL. This gate makes that experience explicit. Provider APIs also enforce
 * their own service entitlement; this component is UX, not the security wall.
 */
export default function ServiceAccessGate({ pathname = '', children }) {
  const service = getActiveServiceInfo(pathname);
  const [state, setState] = useState({ loading: Boolean(service), allowed: !service, reason: '' });

  useEffect(() => {
    let mounted = true;

    if (!service) {
      setState({ loading: false, allowed: true, reason: '' });
      return () => {
        mounted = false;
      };
    }

    setState({ loading: true, allowed: false, reason: '' });
    apiClient
      .get('/api/services/access')
      .then((response) => {
        if (!mounted) return;
        const entitlement = response?.data?.data?.[service.slug];
        setState({
          loading: false,
          allowed: entitlement?.enabled === true,
          reason: entitlement?.reason || 'This service is not included in your current access.',
        });
      })
      .catch(() => {
        if (mounted) setState({ loading: false, allowed: false, reason: 'Could not verify service access.' });
      });

    return () => {
      mounted = false;
    };
  }, [service?.slug]);

  if (state.loading) {
    return (
      <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}>
        <Stack alignItems="center" spacing={1.5}>
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">Checking access…</Typography>
        </Stack>
      </Box>
    );
  }

  if (!state.allowed) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 760 }}>
        <Stack spacing={2}>
          <Alert severity="info" icon={<LockRoundedIcon />}>
            <Typography fontWeight={700}>{service?.label || 'Service'} is visible, but not enabled for this account.</Typography>
            <Typography variant="body2">{state.reason}</Typography>
          </Alert>
          <Button component={NextLink} href="/home" variant="contained" sx={{ alignSelf: 'flex-start' }}>
            Back to all services
          </Button>
        </Stack>
      </Box>
    );
  }

  return children;
}
