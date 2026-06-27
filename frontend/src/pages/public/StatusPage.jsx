import React from 'react';
import {
  Container, Typography, Box, Paper, Chip, Divider, Stack, LinearProgress
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import { motion } from 'framer-motion';

const STATUS = {
  operational: { label: 'Operational', color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
  degraded: { label: 'Degraded', color: 'warning', icon: <WarningAmberIcon fontSize="small" /> },
  outage: { label: 'Outage', color: 'error', icon: <ErrorIcon fontSize="small" /> },
};

const SERVICES = [
  { name: 'API Gateway', description: 'REST API and authentication endpoints', status: 'operational', uptime: 99.98 },
  { name: 'WhatsApp Cloud API', description: 'Connectivity to Meta\'s WhatsApp Cloud API', status: 'operational', uptime: 99.95 },
  { name: 'Webhook Delivery', description: 'Outbound webhook event delivery to customer endpoints', status: 'operational', uptime: 99.91 },
  { name: 'Message Queue', description: 'Asynchronous message processing and queuing', status: 'operational', uptime: 99.99 },
  { name: 'Database', description: 'Primary data storage and retrieval', status: 'operational', uptime: 99.99 },
  { name: 'Dashboard', description: 'Web dashboard and admin interface', status: 'operational', uptime: 99.97 },
  { name: 'CDN / Media Storage', description: 'Media file storage and delivery', status: 'operational', uptime: 99.90 },
  { name: 'Embedded Signup', description: 'WhatsApp Business Account onboarding flow', status: 'operational', uptime: 99.85 },
];

const INCIDENTS = [
  {
    id: 1,
    title: 'Elevated Webhook Delivery Latency',
    status: 'Resolved',
    severity: 'Minor',
    date: '2025-06-10',
    resolvedAt: '2025-06-10T14:32:00Z',
    duration: '47 minutes',
    updates: [
      { time: '2025-06-10T14:32:00Z', message: 'This incident has been resolved. Webhook delivery latency has returned to normal levels.' },
      { time: '2025-06-10T14:15:00Z', message: 'We have identified the root cause as a misconfigured load balancer rule introduced during a routine deployment. A fix has been applied and we are monitoring.' },
      { time: '2025-06-10T13:45:00Z', message: 'We are investigating reports of elevated latency in webhook delivery. Some webhooks are experiencing delays of 5-15 seconds.' },
    ],
  },
  {
    id: 2,
    title: 'WhatsApp Cloud API Connection Interruption',
    status: 'Resolved',
    severity: 'Major',
    date: '2025-05-22',
    resolvedAt: '2025-05-22T09:18:00Z',
    duration: '23 minutes',
    updates: [
      { time: '2025-05-22T09:18:00Z', message: 'Meta has resolved the connectivity issue on their end. All services are operating normally. Queued messages have been delivered.' },
      { time: '2025-05-22T09:05:00Z', message: 'Meta has acknowledged the issue and is working on a fix. Our message queue is capturing all failed sends for retry once connectivity is restored.' },
      { time: '2025-05-22T08:55:00Z', message: 'We are experiencing connectivity issues with Meta\'s WhatsApp Cloud API. Message sending is currently unavailable. We are investigating.' },
    ],
  },
  {
    id: 3,
    title: 'Dashboard Login Slowness',
    status: 'Resolved',
    severity: 'Minor',
    date: '2025-05-08',
    resolvedAt: '2025-05-08T16:44:00Z',
    duration: '31 minutes',
    updates: [
      { time: '2025-05-08T16:44:00Z', message: 'Resolved. The authentication service has been restarted and login times are back to normal.' },
      { time: '2025-05-08T16:20:00Z', message: 'The issue has been identified as high memory usage on the authentication service. We are restarting the service now.' },
      { time: '2025-05-08T16:13:00Z', message: 'We are seeing slower than normal login times for the dashboard. API functionality is not affected.' },
    ],
  },
];

const UptimeBar = ({ uptime }) => {
  const days = 90;
  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', gap: 0.25, mb: 0.5 }}>
        {Array.from({ length: days }).map((_, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: 20,
              borderRadius: 0.5,
              bgcolor: i > days - 5 && uptime < 99.9 ? 'warning.main' : 'success.main',
              opacity: i > days - 3 ? 1 : 0.6 + (i / days) * 0.4,
            }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.disabled">90 days ago</Typography>
        <Typography variant="caption" color="text.disabled">Today</Typography>
      </Box>
    </Box>
  );
};

export default function StatusPage() {
  const allOperational = SERVICES.every((s) => s.status === 'operational');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        <Box
          sx={{
            bgcolor: allOperational ? '#0a4f2f' : '#7a3200',
            color: 'white',
            py: { xs: 8, md: 10 },
            textAlign: 'center',
          }}
        >
          <Container maxWidth="md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
              {allOperational ? (
                <CheckCircleIcon sx={{ fontSize: 64, color: '#25d366', mb: 2 }} />
              ) : (
                <WarningAmberIcon sx={{ fontSize: 64, color: '#ffb74d', mb: 2 }} />
              )}
              <Typography variant="h3" fontWeight={800} sx={{ color: 'white', mb: 1 }}>
                {allOperational ? 'All Systems Operational' : 'Partial Service Disruption'}
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                Updated {new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC
              </Typography>
            </motion.div>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: 6 }}>
          <Box sx={{ mb: 6 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Service Status</Typography>
            <Stack spacing={2}>
              {SERVICES.map((service, i) => {
                const statusInfo = STATUS[service.status];
                return (
                  <motion.div
                    key={service.name}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={700}>{service.name}</Typography>
                          <Typography variant="body2" color="text.secondary">{service.description}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.disabled" display="block">90-day uptime</Typography>
                            <Typography variant="body2" fontWeight={700} color="success.main">
                              {service.uptime}%
                            </Typography>
                          </Box>
                          <Chip
                            label={statusInfo.label}
                            color={statusInfo.color}
                            size="small"
                            icon={statusInfo.icon}
                          />
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={service.uptime}
                        color={statusInfo.color}
                        sx={{ borderRadius: 1, height: 4, bgcolor: 'action.hover' }}
                      />
                    </Paper>
                  </motion.div>
                );
              })}
            </Stack>
          </Box>

          <Divider sx={{ mb: 6 }} />

          <Box>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>Incident History</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Past incidents and outages from the last 90 days
            </Typography>

            {INCIDENTS.length === 0 ? (
              <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 40, mb: 1 }} />
                <Typography variant="body1" color="text.secondary">No incidents in the past 90 days</Typography>
              </Paper>
            ) : (
              <Stack spacing={3}>
                {INCIDENTS.map((incident) => (
                  <Paper
                    key={incident.id}
                    elevation={0}
                    sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>{incident.title}</Typography>
                        <Typography variant="caption" color="text.disabled">
                          {incident.date} · Duration: {incident.duration}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          label={incident.severity}
                          size="small"
                          color={incident.severity === 'Major' ? 'error' : 'warning'}
                          variant="outlined"
                        />
                        <Chip
                          label={incident.status}
                          size="small"
                          color="success"
                          icon={<CheckCircleIcon />}
                        />
                      </Stack>
                    </Box>

                    <Stack spacing={2}>
                      {incident.updates.map((update, i) => (
                        <Box key={i} sx={{ display: 'flex', gap: 2 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: i === 0 ? 'success.main' : 'text.disabled',
                              mt: 0.75,
                              flexShrink: 0,
                            }}
                          />
                          <Box>
                            <Typography variant="caption" color="text.disabled" display="block">
                              {new Date(update.time).toLocaleString('en-US', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })} UTC
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                              {update.message}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>

          <Paper
            elevation={0}
            sx={{ mt: 6, p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', textAlign: 'center' }}
          >
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Subscribe to Status Updates</Typography>
            <Typography variant="body2" color="text.secondary">
              Get notified via email when incidents are created, updated, or resolved. Email <strong>support@metabsp.com</strong> with "Status Updates" in the subject line.
            </Typography>
          </Paper>
        </Container>
      </Box>
    </motion.div>
  );
}
