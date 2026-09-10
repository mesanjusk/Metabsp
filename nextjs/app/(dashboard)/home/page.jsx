'use client';

import { useEffect, useMemo, useState } from 'react';
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
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import InstagramIcon from '@mui/icons-material/Instagram';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';
import { SERVICES } from '@/lib/ui/app/serviceRegistry';

const emptyOverview = {
  kpis: {},
  channelPerformance: {},
  funnel: {},
  activity: [],
  serviceHealth: [],
};

const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

function MetricCard({ icon: Icon, label, value, helper }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, minWidth: 0 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
          <Typography variant="h4" fontWeight={800} sx={{ mt: 0.35 }}>{compact.format(Number(value || 0))}</Typography>
          <Typography variant="caption" color="text.secondary">{helper}</Typography>
        </Box>
        <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
          <Icon />
        </Box>
      </Stack>
    </Paper>
  );
}

function Section({ title, action, children }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={800}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

export default function BusinessControlCenterPage() {
  const [overview, setOverview] = useState(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiClient
      .get('/api/services/overview')
      .then((response) => {
        if (active) setOverview(response?.data?.data || emptyOverview);
      })
      .catch((err) => {
        if (active) setError(err?.response?.data?.message || 'Could not load business overview.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const kpis = overview.kpis || {};
  const whatsapp = overview.channelPerformance?.whatsapp || {};
  const instagram = overview.channelPerformance?.instagram || {};
  const maxChannelVolume = Math.max(Number(whatsapp.messagesToday || 0), 1);

  const funnelRows = useMemo(() => [
    ['New', overview.funnel?.new || 0],
    ['Interested', overview.funnel?.interested || 0],
    ['Follow-up', overview.funnel?.followUp || 0],
    ['Quotation', overview.funnel?.quotation || 0],
    ['Converted', overview.funnel?.converted || 0],
    ['Lost', overview.funnel?.lost || 0],
  ], [overview.funnel]);

  const funnelMax = Math.max(...funnelRows.map(([, value]) => Number(value || 0)), 1);
  const healthBySlug = Object.fromEntries((overview.serviceHealth || []).map((item) => [item.service, item]));

  return (
    <PageBody
      title="Business Control Center"
      description="One view of your customers, conversations and connected digital services. Use the service strip above to open any tool."
    >
      {loading ? (
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Loading business activity…</Typography>
        </Stack>
      ) : null}
      {error ? <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' }, gap: 1.5, mb: 2 }}>
        <MetricCard icon={PeopleAltRoundedIcon} label="CONTACTS" value={kpis.totalContacts} helper={`${kpis.newContacts7d || 0} new in 7 days`} />
        <MetricCard icon={ForumRoundedIcon} label="MESSAGES TODAY" value={kpis.messagesToday} helper={`${kpis.incomingToday || 0} received`} />
        <MetricCard icon={ChatBubbleOutlineRoundedIcon} label="ACTIVE CHATS" value={kpis.activeChats} helper="Open customer windows" />
        <MetricCard icon={AppsRoundedIcon} label="AVAILABLE TOOLS" value={kpis.availableTools} helper="Enabled for this account" />
        <MetricCard icon={CheckCircleRoundedIcon} label="CONNECTED" value={kpis.connectedChannels} helper="Live channels" />
        <MetricCard icon={TrendingUpRoundedIcon} label="OUTGOING TODAY" value={kpis.outgoingToday} helper="Messages sent" />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.15fr 0.85fr' }, gap: 2, mb: 2 }}>
        <Section title="Channel performance">
          <Stack spacing={2.25}>
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                <Stack direction="row" alignItems="center" spacing={1}><WhatsAppIcon fontSize="small" /><Typography fontWeight={750}>WhatsApp</Typography></Stack>
                <Typography variant="body2" fontWeight={800}>{compact.format(Number(whatsapp.messagesToday || 0))} today</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={Math.min(100, (Number(whatsapp.messagesToday || 0) / maxChannelVolume) * 100)} sx={{ height: 9, borderRadius: 5 }} />
              <Stack direction="row" spacing={2} sx={{ mt: 0.75 }}>
                <Typography variant="caption" color="text.secondary">↓ {whatsapp.incomingToday || 0} received</Typography>
                <Typography variant="caption" color="text.secondary">↑ {whatsapp.outgoingToday || 0} sent</Typography>
              </Stack>
            </Box>

            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                <Stack direction="row" alignItems="center" spacing={1}><InstagramIcon fontSize="small" /><Typography fontWeight={750}>Instagram</Typography></Stack>
                <Chip size="small" label={instagram.connected ? 'Connected' : 'Not connected'} variant="outlined" />
              </Stack>
              <LinearProgress variant="determinate" value={instagram.connected ? 100 : 0} sx={{ height: 9, borderRadius: 5 }} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>{instagram.note || 'Connect Instagram to start collecting activity.'}</Typography>
            </Box>

            <Typography variant="caption" color="text.secondary">
              Google Business, Dialer, Store and other channel metrics will appear here automatically as those services start writing events to the shared workspace.
            </Typography>
          </Stack>
        </Section>

        <Section title="Lead funnel">
          <Stack spacing={1.35}>
            {funnelRows.map(([label, value]) => (
              <Box key={label}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" fontWeight={800}>{value}</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={(Number(value || 0) / funnelMax) * 100} sx={{ height: 7, borderRadius: 5 }} />
              </Box>
            ))}
            <Typography variant="caption" color="text.secondary">Built from the Category field in your shared contacts. Existing custom categories are mapped to the closest funnel stage.</Typography>
          </Stack>
        </Section>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, mb: 2 }}>
        <Section title="Recent activity" action={<Button component={NextLink} href="/inbox" size="small">Open inbox</Button>}>
          <Stack spacing={0.5}>
            {(overview.activity || []).length ? overview.activity.map((item) => (
              <Stack key={item.id} direction="row" spacing={1.25} alignItems="flex-start" sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
                <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {item.type === 'message' ? <ForumRoundedIcon fontSize="small" /> : <PeopleAltRoundedIcon fontSize="small" />}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={750} noWrap>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{item.detail || 'Activity recorded'}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{item.at ? new Date(item.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</Typography>
              </Stack>
            )) : <Typography variant="body2" color="text.secondary">No recent activity yet.</Typography>}
          </Stack>
        </Section>

        <Section title="Quick actions">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
            <Button component={NextLink} href="/contacts" variant="outlined" startIcon={<AddRoundedIcon />} sx={{ minHeight: 56 }}>Contacts</Button>
            <Button component={NextLink} href="/inbox" variant="outlined" startIcon={<WhatsAppIcon />} sx={{ minHeight: 56 }}>Inbox</Button>
            <Button component={NextLink} href="/services/marketing" variant="outlined" startIcon={<CampaignRoundedIcon />} sx={{ minHeight: 56 }}>Create post</Button>
            <Button component={NextLink} href="/instagram" variant="outlined" startIcon={<InstagramIcon />} sx={{ minHeight: 56 }}>Instagram</Button>
            <Button component={NextLink} href="/settings" variant="outlined" startIcon={<SettingsRoundedIcon />} sx={{ minHeight: 56 }}>Settings</Button>
          </Box>
        </Section>
      </Box>

      <Section title="Service health">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' }, gap: 1 }}>
          {SERVICES.map((service) => {
            const item = healthBySlug[service.slug] || {};
            const connected = item.connection === 'connected';
            const available = item.enabled && item.connection !== 'locked';
            const Icon = service.icon;
            return (
              <Box key={service.slug} sx={{ p: 1.35, border: '1px solid', borderColor: 'divider', borderRadius: 2.5, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 30, height: 30, borderRadius: 2, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon fontSize="small" /></Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="caption" fontWeight={800} noWrap sx={{ display: 'block' }}>{service.shortLabel || service.label}</Typography>
                    <Typography variant="caption" color={connected || available ? 'success.main' : 'text.secondary'} noWrap sx={{ display: 'block' }}>
                      {connected ? '● Connected' : available ? '● Available' : service.status === 'planned' ? 'Coming soon' : 'Locked'}
                    </Typography>
                  </Box>
                  {!available && service.status !== 'planned' ? <LockRoundedIcon sx={{ fontSize: 15 }} color="disabled" /> : null}
                </Stack>
              </Box>
            );
          })}
        </Box>
      </Section>
    </PageBody>
  );
}
