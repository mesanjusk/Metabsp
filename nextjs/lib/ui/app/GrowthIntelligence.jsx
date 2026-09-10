'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import apiClient from '@/lib/api/client';

const EMPTY = {
  summary: {},
  agents: {},
  recommendations: [],
};

const AGENTS = [
  {
    key: 'support',
    title: 'Customer Support',
    icon: SupportAgentRoundedIcon,
    description: 'Prioritises customer conversations that need a response using the existing shared inbox.',
    href: '/inbox',
    actionLabel: 'Open inbox',
  },
  {
    key: 'marketing',
    title: 'Marketing',
    icon: CampaignRoundedIcon,
    description: 'Finds past customers worth reactivating and routes campaigns through the existing Marketing service.',
    href: '/services/marketing',
    actionLabel: 'Open marketing',
  },
  {
    key: 'localGrowth',
    title: 'Local Growth',
    icon: TravelExploreRoundedIcon,
    description: 'Keeps Google Business Profile inside the same service architecture and marks it live only after a real provider connection exists.',
    href: '/services/google-business',
    actionLabel: 'Google Business',
  },
  {
    key: 'analyst',
    title: 'Business Analyst',
    icon: InsightsRoundedIcon,
    description: 'Reads the shared contact funnel and highlights active opportunities and missed follow-ups.',
    href: '/analytics',
    actionLabel: 'Open analytics',
  },
];

function statusLabel(value) {
  if (value === 'live') return 'Live';
  if (value === 'locked') return 'Pro';
  if (value === 'setup') return 'Setup';
  if (value === 'next') return 'Next';
  return 'Ready';
}

function priorityLabel(value) {
  if (value === 'urgent') return 'Urgent';
  if (value === 'high') return 'High';
  if (value === 'medium') return 'Medium';
  return 'Opportunity';
}

export default function GrowthIntelligence() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiClient.get('/api/services/growth')
      .then((response) => {
        if (active) setData(response?.data?.data || EMPTY);
      })
      .catch((err) => {
        if (active) setError(err?.response?.data?.message || 'Could not load growth insights.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const recommendations = data.recommendations || [];
  const summary = data.summary || {};

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={800}>AI Growth Team</Typography>
            <Typography variant="caption" color="text.secondary">
              One intelligence layer using your existing tenant, contacts, inbox and service permissions.
            </Typography>
          </Box>
          <Chip icon={<AutoAwesomeRoundedIcon />} label={loading ? 'Analysing…' : 'Shared business brain'} variant="outlined" />
        </Stack>

        {error ? <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert> : null}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', xl: 'repeat(4, minmax(0,1fr))' }, gap: 1.25 }}>
          {AGENTS.map((definition) => {
            const state = data.agents?.[definition.key] || {};
            const Icon = definition.icon;
            return (
              <Paper key={definition.key} variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, minWidth: 0, height: '100%' }}>
                <Stack spacing={1.2} height="100%">
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Box sx={{ width: 38, height: 38, borderRadius: 2.25, bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
                      <Icon fontSize="small" />
                    </Box>
                    <Chip size="small" variant="outlined" label={loading ? 'Checking' : statusLabel(state.status)} />
                  </Stack>
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={800}>{definition.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>{definition.description}</Typography>
                    {!loading && state.metricLabel ? (
                      <Typography variant="body2" fontWeight={800} sx={{ mt: 1 }}>
                        {Number(state.metric || 0).toLocaleString('en-IN')} {state.metricLabel}
                      </Typography>
                    ) : null}
                  </Box>
                  <Button component={NextLink} href={definition.href} size="small" variant="text" sx={{ alignSelf: 'flex-start', px: 0 }}>
                    {definition.actionLabel}
                  </Button>
                </Stack>
              </Paper>
            );
          })}
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={800}>What needs attention</Typography>
            <Typography variant="caption" color="text.secondary">
              Rule-based recommendations from live shared data. No duplicate lead database and no AI token cost for this scan.
            </Typography>
          </Box>
          {!loading ? (
            <Stack direction="row" spacing={0.75}>
              {summary.urgentCount ? <Chip size="small" icon={<PriorityHighRoundedIcon />} label={`${summary.urgentCount} urgent`} /> : null}
              {summary.highCount ? <Chip size="small" label={`${summary.highCount} high`} variant="outlined" /> : null}
            </Stack>
          ) : null}
        </Stack>

        {loading ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
            <CircularProgress size={17} />
            <Typography variant="body2" color="text.secondary">Checking customers, follow-ups and channel readiness…</Typography>
          </Stack>
        ) : recommendations.length ? (
          <Stack spacing={1}>
            {recommendations.slice(0, 6).map((item) => (
              <Box key={item.id} sx={{ p: 1.35, border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.25}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.35 }}>
                      <Chip size="small" label={priorityLabel(item.priority)} variant="outlined" />
                      <Typography variant="subtitle2" fontWeight={800}>{item.title}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{item.detail}</Typography>
                  </Box>
                  <Button component={NextLink} href={item.href} size="small" variant="outlined" sx={{ flexShrink: 0 }}>
                    {item.actionLabel}
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">No immediate growth action is flagged from the available shared data.</Typography>
        )}
      </Paper>
    </Stack>
  );
}
