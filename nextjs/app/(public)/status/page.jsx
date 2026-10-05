'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';

const stateMeta = {
  checking: { label: 'Checking live health…', color: 'default', icon: <HelpOutlineRoundedIcon /> },
  operational: { label: 'Application reachable', color: 'success', icon: <CheckCircleRoundedIcon /> },
  degraded: { label: 'Application reachable · database unavailable', color: 'warning', icon: <ErrorOutlineRoundedIcon /> },
  unavailable: { label: 'Live health unavailable', color: 'error', icon: <ErrorOutlineRoundedIcon /> },
};

export default function StatusPage() {
  const [state, setState] = useState('checking');
  const [health, setHealth] = useState(null);
  const [checkedAt, setCheckedAt] = useState('');

  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const response = await fetch('/api/health?strict=1', { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        setHealth(data);
        setState(response.ok && data?.dbReady ? 'operational' : 'degraded');
      } catch {
        if (!active) return;
        setHealth(null);
        setState('unavailable');
      } finally {
        if (active) setCheckedAt(new Date().toISOString());
      }
    };

    check();
    const timer = window.setInterval(check, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const meta = stateMeta[state];

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100dvh', py: { xs: 5, md: 8 } }}>
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h3" fontWeight={800} sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>
              SK Digital service status
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 720 }}>
              This page reports only health the running application can verify now. We do not publish invented uptime percentages,
              incident history or an SLA that has not been independently measured.
            </Typography>
          </Box>

          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>Production application</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Dashboard/API process and primary database readiness.
                  </Typography>
                </Box>
                <Chip label={meta.label} color={meta.color} icon={meta.icon} />
              </Stack>

              {health ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' }, gap: 1.5 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">PROCESS</Typography>
                    <Typography fontWeight={700}>{health.alive ? 'Alive' : 'Unknown'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">DATABASE</Typography>
                    <Typography fontWeight={700}>{health.db || 'Unknown'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">UPTIME THIS PROCESS</Typography>
                    <Typography fontWeight={700}>
                      {Number.isFinite(Number(health.uptimeSeconds)) ? `${Math.floor(Number(health.uptimeSeconds) / 60)} min` : 'Unknown'}
                    </Typography>
                  </Box>
                </Box>
              ) : null}

              {checkedAt ? (
                <Typography variant="caption" color="text.secondary">
                  Last checked: {new Date(checkedAt).toLocaleString()}
                </Typography>
              ) : null}
            </Stack>
          </Paper>

          {state === 'degraded' ? (
            <Alert severity="warning">
              The web process answered, but the primary database did not report ready. Customer actions that require stored data may fail.
            </Alert>
          ) : null}

          {state === 'unavailable' ? (
            <Alert severity="error">
              This browser could not verify live health. Check the production service and hosting provider before treating the product as available.
            </Alert>
          ) : null}

          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>What this page does not claim</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              Meta, Instagram, Google Business Profile, RCS providers, Cloudinary and other connected services are external systems.
              Their availability is not represented as “operational” here unless SK Digital has independent monitoring evidence for them.
              Historical uptime and incident metrics should be added only after real monitoring has collected them.
            </Typography>
          </Paper>

          <Typography variant="body2" color="text.secondary">
            For service-impacting issues, contact <strong>support@meta.sanjusk.in</strong>.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
