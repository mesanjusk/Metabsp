'use client';

import NextLink from 'next/link';
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import { SERVICES } from '@/lib/ui/app/serviceRegistry';

const STATUS_LABELS = {
  active: 'Ready',
  beta: 'Beta',
  planned: 'Coming soon',
};

export default function ServiceHubPage() {
  return (
    <PageBody
      title="Your business tools"
      description="Choose a service. Each service opens its own workspace while customer, team and business data stay connected across the platform."
    >
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
        {SERVICES.map((service) => {
          const Icon = service.icon;
          const isAvailable = service.status === 'active' || service.status === 'beta';

          return (
            <Card key={service.slug} variant="outlined" sx={{ height: '100%', borderRadius: 3 }}>
              <CardActionArea
                component={NextLink}
                href={service.href}
                sx={{ height: '100%', p: 2.5, alignItems: 'stretch' }}
              >
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
                        color: 'text.primary',
                      }}
                    >
                      <Icon fontSize="medium" />
                    </Box>
                    <Chip
                      size="small"
                      label={STATUS_LABELS[service.status] || service.status}
                      color={service.status === 'active' ? 'success' : service.status === 'beta' ? 'primary' : 'default'}
                      variant={isAvailable ? 'filled' : 'outlined'}
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

                  <Typography variant="body2" fontWeight={650} color="primary.main">
                    {isAvailable ? 'Open dashboard →' : 'View module →'}
                  </Typography>
                </Stack>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </PageBody>
  );
}
