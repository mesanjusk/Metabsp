'use client';

import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, Box, Button, Card, Stack, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PageBody from '@/lib/ui/app/PageBody';
import { getServiceBySlug } from '@/lib/ui/app/serviceRegistry';

export default function ServiceModulePage() {
  const params = useParams();
  const slug = Array.isArray(params?.service) ? params.service[0] : params?.service;
  const service = getServiceBySlug(slug);

  if (!service) {
    return (
      <PageBody title="Service not found" description="This module is not registered in the workspace.">
        <Button component={NextLink} href="/home" startIcon={<ArrowBackRoundedIcon />}>
          Back to services
        </Button>
      </PageBody>
    );
  }

  const Icon = service.icon;

  return (
    <PageBody title={service.label} description={service.description}>
      <Stack spacing={2.5}>
        <Alert severity="info">
          This service has its own dashboard shell. Its integration tools will be added here without creating a separate customer database.
        </Alert>

        <Card variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'action.hover',
                flexShrink: 0,
              }}
            >
              <Icon fontSize="large" />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                {service.label} workspace
              </Typography>
              <Typography color="text.secondary">
                Shared account, organization, contacts, billing and staff data remain available to this module. Only provider-specific credentials and configuration stay isolated to the service.
              </Typography>
            </Box>
          </Stack>
        </Card>

        <Button component={NextLink} href="/home" startIcon={<ArrowBackRoundedIcon />} sx={{ alignSelf: 'flex-start' }}>
          All services
        </Button>
      </Stack>
    </PageBody>
  );
}
