'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { alpha } from '@mui/material/styles';
import {
  Alert,
  Box,
  ButtonBase,
  Button,
  Chip,
  CircularProgress,
  Fab,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
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
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import PageBody from '@/lib/ui/app/PageBody';
import GrowthIntelligence from '@/lib/ui/app/GrowthIntelligence';
import apiClient from '@/lib/api/client';
import { SERVICES } from '@/lib/ui/app/serviceRegistry';
import { brand, layout, neutral, spacing, typeScale } from '@/lib/ui/tokens';

const emptyOverview = {
  kpis: {},
  channelPerformance: {},
  funnel: {},
  serviceHealth: [],
};

const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

function MetricCard({ icon: Icon, label, value, helper, delta, unavailable }) {
  const hasDelta = !unavailable && typeof delta === 'number' && Number.isFinite(delta);
  const rising = hasDelta && delta >= 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: `${spacing.cardPaddingCompact}px`, sm: `${spacing.cardPadding}px` },
        borderRadius: 3,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={1}
        sx={{ minHeight: 34 }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={600}
          sx={{ minWidth: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          {label}
        </Typography>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'action.selected',
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 18 }} />
        </Box>
      </Stack>

      <Typography
        sx={{
          fontSize: typeScale.kpi,
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          color: 'primary.main',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {unavailable ? '—' : compact.format(Number(value || 0))}
      </Typography>

      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, flexWrap: 'wrap' }}>
        {hasDelta ? (
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.25}
            sx={{
              px: 0.75,
              py: 0.125,
              borderRadius: 999,
              flexShrink: 0,
              bgcolor: (theme) => alpha(theme.palette[rising ? 'success' : 'error'].main, 0.12),
              color: rising ? 'success.main' : 'error.main',
            }}
          >
            {rising ? (
              <ArrowUpwardRoundedIcon sx={{ fontSize: 13 }} />
            ) : (
              <ArrowDownwardRoundedIcon sx={{ fontSize: 13 }} />
            )}
            <Typography variant="caption" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {Math.abs(delta)}%
            </Typography>
          </Stack>
        ) : null}
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
          {unavailable ? 'Awaiting activity data' : hasDelta ? helper : helper || 'No comparison yet'}
        </Typography>
      </Stack>
    </Paper>
  );
}

function Section({ title, subtitle, action, children }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={800}>{title}</Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{subtitle}</Typography>
          ) : null}
        </Box>
        {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
      </Stack>
      {children}
    </Paper>
  );
}

export default function BusinessControlCenterPage() {
  const [quickActionsAnchor, setQuickActionsAnchor] = useState(null);
  const quickActionsOpen = Boolean(quickActionsAnchor);
  const closeQuickActions = () => setQuickActionsAnchor(null);
  const [overview, setOverview] = useState(emptyOverview);
  const [selectedServices, setSelectedServices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.get('/api/services/overview'),
      apiClient.get('/api/business-profile'),
    ])
      .then(([overviewResponse, profileResponse]) => {
        if (!active) return;
        setOverview(overviewResponse?.data?.data || emptyOverview);
        const selected = profileResponse?.data?.data?.selectedServices;
        setSelectedServices(Array.isArray(selected) ? selected : null);
      })
      .catch((err) => {
        if (active) setError(err?.response?.data?.message || 'Could not load business overview.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const kpis = overview.kpis || {};
  const deltas = overview.deltas || {};
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
  const visibleServices = selectedServices
    ? SERVICES.filter((service) => selectedServices.includes(service.slug))
    : SERVICES;

  return (
    <PageBody
      title="Workspace overview"
      description="Your customers, conversations and next steps, all in one place."
      actions={<Button component={NextLink} href="/inbox" variant="contained" startIcon={<ForumRoundedIcon />}>Open inbox</Button>}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' }, mb: 3, borderRadius: 3, overflow: 'hidden', bgcolor: (t) => (t.palette.mode === 'dark' ? brand[900] : brand[100]),
        color: (t) => (t.palette.mode === 'dark' ? brand[50] : neutral[900]) }}>
        <Box sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="overline" sx={{ color: (t) => (t.palette.mode === 'dark' ? brand[300] : brand[700]) }}>A LITTLE CLARITY. A LOT MORE POSSIBILITY.</Typography>
          <Typography component="h2" sx={{ fontSize: { xs: '1.875rem', md: '2.5rem' }, lineHeight: 1.15, fontWeight: 650, letterSpacing: '-0.04em', mt: 1, mb: 1.5 }}>Make room for<br />your next big idea.</Typography>
          <Typography variant="body2" sx={{ color: (t) => (t.palette.mode === 'dark' ? brand[100] : neutral[700]), maxWidth: 440 }}>Keep the everyday work moving. Connect with customers, follow up on leads and bring your team together.</Typography>
        </Box>
        <Stack spacing={1.5} sx={{ p: { xs: 3, md: 4 }, justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.045)', borderLeft: { md: '1px solid rgba(255,255,255,0.1)' } }}>
          <Typography variant="overline" sx={{ color: (t) => (t.palette.mode === 'dark' ? brand[300] : brand[700]) }}>PICK UP WHERE IT MATTERS</Typography>
          {[[PeopleAltRoundedIcon, 'Manage your customers', '/contacts'], [CampaignRoundedIcon, 'Plan your next campaign', '/broadcasts']].map(([Icon, label, href]) => (
            <ButtonBase component={NextLink} href={href} key={href} sx={{ p: 1.75, borderRadius: 2, textAlign: 'left', justifyContent: 'space-between', gap: 1, color: 'inherit', border: '1px solid', borderColor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.18)' : brand[300]), '&:hover': { bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : brand[200]) } }}>
              <Icon fontSize="small" /><Typography variant="body2" sx={{ flex: 1 }}>{label}</Typography><ArrowOutwardRoundedIcon sx={{ fontSize: 17 }} />
            </ButtonBase>
          ))}
        </Stack>
      </Box>
      {loading ? (
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Loading business activity…</Typography>
        </Stack>
      ) : null}
      {error ? <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: 1.5, md: `${spacing.gutter}px` }, mb: `${spacing.gutter}px` }}>
        <MetricCard unavailable={loading || Boolean(error)} icon={PeopleAltRoundedIcon} label="Contacts" value={kpis.totalContacts} delta={deltas.totalContacts} helper={`${kpis.newContacts7d || 0} new in 7 days`} />
        <MetricCard unavailable={loading || Boolean(error)} icon={ForumRoundedIcon} label="Messages today" value={kpis.messagesToday} delta={deltas.messagesToday} helper="vs yesterday" />
        <MetricCard unavailable={loading || Boolean(error)} icon={ChatBubbleOutlineRoundedIcon} label="Active chats" value={kpis.activeChats} helper="Open customer windows" />
        <MetricCard unavailable={loading || Boolean(error)} icon={AppsRoundedIcon} label="Available tools" value={kpis.availableTools} helper="Enabled for this account" />
        <MetricCard unavailable={loading || Boolean(error)} icon={CheckCircleRoundedIcon} label="Connected" value={kpis.connectedChannels} helper="Live channels" />
        <MetricCard unavailable={loading || Boolean(error)} icon={TrendingUpRoundedIcon} label="Outgoing today" value={kpis.outgoingToday} delta={deltas.outgoingToday} helper="vs yesterday" />
      </Box>

      <Box sx={{ mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
          <Box>
            <Typography component="h2" variant="h5" fontWeight={750}>Your business toolkit</Typography>
            <Typography variant="caption" color="text.secondary">Only tools selected for your business profile are shown.</Typography>
          </Box>
          <Button component={NextLink} href="/setup/business-profile" size="small" variant="outlined">Edit business profile</Button>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
          {visibleServices.map((service) => {
            const Icon = service.icon;
            const released = service.status === 'active' || service.status === 'beta';
            const health = healthBySlug[service.slug] || {};
            const connected = health.connection === 'connected';
            const available = health.enabled && health.connection !== 'locked';
            const status = !released
              ? 'Coming soon'
              : connected
                ? 'Connected'
                : available
                  ? 'Available'
                  : 'Locked';
            return (
              <Paper key={service.slug} variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', minWidth: 0 }}>
                <ButtonBase component={released ? NextLink : 'div'} href={released ? service.href : undefined} disabled={!released} sx={{ display: 'flex', width: '100%', height: '100%', textAlign: 'left', alignItems: 'flex-start', p: 2.5, gap: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                  <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'action.selected', color: 'primary.main' }}><Icon /></Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={750}>{service.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', my: 0.75 }}>{service.description}</Typography>
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      {status === 'Locked' ? <LockRoundedIcon sx={{ fontSize: 14 }} color="disabled" /> : null}
                      <Typography variant="caption" sx={{ color: connected || available ? 'success.main' : 'text.secondary', fontWeight: 650 }}>
                        {status}
                      </Typography>
                    </Stack>
                  </Box>
                  {released ? <ArrowOutwardRoundedIcon sx={{ fontSize: 17, color: 'text.secondary' }} /> : null}
                </ButtonBase>
              </Paper>
            );
          })}
        </Box>
      </Box>
      <Box sx={{ mb: 3 }}>
        <GrowthIntelligence />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.15fr 0.85fr' }, gap: 2, mb: 2 }}>
        <Section title="Channel performance" subtitle="Combined view across connected services.">
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
              Google Business, Dialer, Store and future services appear here as they start writing events to the shared workspace.
            </Typography>
          </Stack>
        </Section>

        <Section title="Lead funnel" subtitle="See where your next customers are in their journey.">
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
            <Typography variant="caption" color="text.secondary">Keep customer categories up to date to track progress from first enquiry to conversion.</Typography>
          </Stack>
        </Section>
      </Box>

      <Box sx={{ height: 80 }} />
      <Fab
        id="home-quick-actions-button"
        color="primary"
        variant="extended"
        aria-label="Quick actions"
        aria-haspopup="menu"
        aria-controls={quickActionsOpen ? 'home-quick-actions-menu' : undefined}
        aria-expanded={quickActionsOpen}
        onClick={(event) => setQuickActionsAnchor(event.currentTarget)}
        sx={{
          position: 'fixed',
          right: { xs: 16, md: 24 },
          bottom: { xs: `calc(${layout.mobileTabBarTotal} + 16px)`, sm: 24 },
          zIndex: (theme) => theme.zIndex.appBar + 1,
          gap: 1,
          px: 2.5,
          minHeight: 56,
        }}
      >
        <AddRoundedIcon />
        Quick actions
      </Fab>
      <Menu
        id="home-quick-actions-menu"
        anchorEl={quickActionsAnchor}
        open={quickActionsOpen}
        onClose={closeQuickActions}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        MenuListProps={{ 'aria-labelledby': 'home-quick-actions-button' }}
        PaperProps={{ sx: { mb: 1, width: 240, maxWidth: 'calc(100vw - 32px)', borderRadius: 3 } }}
      >
        {[
          [AddRoundedIcon, 'Contacts', '/contacts'],
          [WhatsAppIcon, 'Inbox', '/inbox'],
          [CampaignRoundedIcon, 'Create post', '/services/marketing'],
          [InstagramIcon, 'Instagram', '/instagram'],
          [SettingsRoundedIcon, 'Settings', '/settings'],
        ].map(([Icon, label, href]) => (
          <MenuItem key={href} component={NextLink} href={href} onClick={closeQuickActions} sx={{ minHeight: 48, py: 1.25 }}>
            <ListItemIcon><Icon fontSize="small" /></ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

    </PageBody>
  );
}
