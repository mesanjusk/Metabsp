'use client';

import { useCallback, useEffect, useState } from 'react';
import { alpha } from '@mui/material/styles';
import NextLink from 'next/link';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import DialpadRoundedIcon from '@mui/icons-material/DialpadRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';
import { parseApiError } from '@/lib/api/parseApiError';

/**
 * The WhatsApp service's front door.
 *
 * Every other service tile opens a screen that says what the service is doing;
 * WhatsApp's dropped you straight into the inbox. That made the busiest channel
 * the only one with no answer to "how is it going" — its numbers existed, split
 * across /analytics and the hub, but nowhere that reading them was the point.
 * It also made the tile behave differently from the other ten for no reason a
 * user could see.
 *
 * So this is the overview, and the inbox is one of the places you go from it.
 */

const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

const SHORTCUTS = [
  { href: '/inbox', label: 'Inbox', description: 'Answer customers', icon: ForumRoundedIcon },
  { href: '/contacts', label: 'Contacts', description: 'Tag and segment', icon: PeopleAltRoundedIcon },
  { href: '/templates', label: 'Templates', description: 'Submit and track', icon: DescriptionRoundedIcon },
  { href: '/broadcasts', label: 'Broadcasts', description: 'Send to a segment', icon: CampaignRoundedIcon },
  { href: '/automations', label: 'Automations', description: 'Replies and flows', icon: BoltRoundedIcon },
  { href: '/analytics', label: 'Full analytics', description: 'Volume over time', icon: InsightsRoundedIcon },
  { href: '/numbers', label: 'Numbers', description: 'Connect and manage', icon: DialpadRoundedIcon },
];

function Metric({ icon: Icon, label, value, helper }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Icon fontSize="small" color="action" />
        <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
      </Stack>
      <Typography sx={{ fontSize: { xs: '1.75rem', sm: '2.25rem' }, letterSpacing: '-0.04em', fontWeight: 750, color: 'primary.main', my: 1 }}>{value}</Typography>
      {helper ? <Typography variant="caption" color="text.secondary">{helper}</Typography> : null}
    </Paper>
  );
}

/** A delivery percentage, with the bar the number deserves. */
function Rate({ label, value, color = 'primary' }) {
  const pct = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="body2" fontWeight={800}>{pct}%</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={pct} color={color} sx={{ height: 8, borderRadius: 5 }} />
    </Box>
  );
}

export default function WhatsAppOverviewPage() {
  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // Settled rather than all: a workspace with no number connected still has
    // contacts and message history worth showing, and the analytics endpoint
    // refuses without an account. One missing half must not blank the page.
    const [overviewResult, analyticsResult] = await Promise.allSettled([
      apiClient.get('/api/services/overview'),
      apiClient.get('/api/whatsapp/analytics'),
    ]);

    if (overviewResult.status === 'fulfilled') {
      setOverview(overviewResult.value?.data?.data || null);
    } else {
      setError(parseApiError(overviewResult.reason, 'Could not load WhatsApp activity.'));
    }
    setAnalytics(analyticsResult.status === 'fulfilled' ? analyticsResult.value?.data?.data || null : null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = overview?.kpis || {};
  const channel = overview?.channelPerformance?.whatsapp || {};
  const health = (overview?.serviceHealth || []).find((item) => item.service === 'whatsapp');
  const connected = health?.connection === 'connected';

  if (loading) {
    return (
      <PageBody title="WhatsApp" description="Your busiest channel, at a glance.">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
      </PageBody>
    );
  }

  return (
    <PageBody
      title="WhatsApp"
      description="Message volume, delivery quality and the shared inbox for your connected numbers."
      actions={<Button size="small" startIcon={<RefreshRoundedIcon />} onClick={load}>Refresh</Button>}
    >
      <Stack spacing={2.5}>
        {error ? <Alert severity="warning" onClose={() => setError('')}>{error}</Alert> : null}

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 48, height: 48, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'action.selected', color: 'primary.main' }}>
                <WhatsAppIcon fontSize="small" />
              </Box>
              <Box>
                <Typography fontWeight={750}>{health?.detail || 'No number connected'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {connected ? 'Sending and receiving on the Cloud API' : 'Connect a number to start sending'}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Chip
                size="small"
                variant="outlined"
                color={connected ? 'success' : 'warning'}
                label={connected ? 'Connected' : 'Not connected'}
              />
              {!connected ? (
                <Button size="small" variant="contained" component={NextLink} href="/numbers">Connect a number</Button>
              ) : null}
            </Stack>
          </Stack>
        </Paper>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(3, minmax(0,1fr))', xl: 'repeat(5, minmax(0,1fr))' }, gap: { xs: 1.5, md: 2 } }}>
          <Metric icon={ForumRoundedIcon} label="Messages today" value={compact.format(Number(kpis.messagesToday || 0))} helper={`${kpis.incomingToday || 0} in · ${kpis.outgoingToday || 0} out`} />
          <Metric icon={ChatBubbleOutlineRoundedIcon} label="Active chats" value={compact.format(Number(kpis.activeChats || 0))} helper="Open 24-hour windows" />
          <Metric icon={PeopleAltRoundedIcon} label="Contacts" value={compact.format(Number(kpis.totalContacts || 0))} helper={`${kpis.newContacts7d || 0} new in 7 days`} />
          <Metric icon={TrendingUpRoundedIcon} label="Campaign messages" value={analytics ? compact.format(Number(analytics.totalSent || 0)) : '—'} helper="Tracked deliveries" />
          <Metric icon={InsightsRoundedIcon} label="Delivered" value={analytics ? `${analytics.deliveredPercentage ?? 0}%` : '—'} helper="Of tracked sends" />
        </Box>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5 }}>Delivery quality</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Track how reliably your campaigns reach customers.
          </Typography>
          {!analytics ? <Alert severity="info">Delivery data is unavailable. Connect a number or refresh to try again.</Alert> : analytics.totalSent ? (
            <Stack spacing={1.75}>
              <Rate label="Delivered" value={analytics.deliveredPercentage} color="success" />
              <Rate label="Read" value={analytics.readPercentage} color="primary" />
              <Rate label="Failed" value={analytics.failedPercentage} color="error" />
            </Stack>
          ) : (
            <Alert severity="info">
              No campaign messages have been tracked yet. Send a broadcast and delivery, read and failure rates appear here.
            </Alert>
          )}
        </Paper>

        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>Go to</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', sm: 'repeat(3, minmax(0,1fr))', lg: 'repeat(4, minmax(0,1fr))' }, gap: 1.25 }}>
            {SHORTCUTS.map(({ href, label, description, icon: Icon }) => (
              <Paper
                key={href}
                component={NextLink}
                href={href}
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  borderTop: (theme) => `3px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                  transition: 'background-color 120ms ease',
                  '&:hover': { bgcolor: 'action.selected', color: 'primary.main' },
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                  <Icon fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={750}>{label}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">{description}</Typography>
              </Paper>
            ))}
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary">
          Messages and contacts are counted across the whole workspace; the shared contact record is the same one the
          CRM and invoices use. Channel-specific totals over time are in{' '}
          <Box component={NextLink} href="/analytics" sx={{ color: 'primary.main' }}>Analytics</Box>.
        </Typography>
      </Stack>
    </PageBody>
  );
}
