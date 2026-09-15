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
import { spacing, typeScale } from '@/lib/ui/tokens';

const emptyOverview = {
  kpis: {},
  channelPerformance: {},
  funnel: {},
  activity: [],
  serviceHealth: [],
};

const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * One KPI, in the pattern the design guide calls for: icon, label, big number, delta.
 *
 * The number is the reason the card exists, so it is the only thing on it at display size and the
 * only thing wearing the brand accent — the guide's rule that the accent belongs to interactive
 * elements, KPI values and CTAs, and nothing else. Everything around it is quiet by comparison.
 *
 * The delta is what turns a fact into information. "412 contacts" tells a shop owner nothing they
 * can act on; "412, up 8% on last week" tells them whether last week's effort worked. Where there
 * is no honest comparison — a previous window of zero, or a KPI that is a state rather than a flow
 * — the card says so rather than rendering a number, because a fabricated "+100%" on a new account
 * is how a dashboard loses someone's trust in the first minute.
 *
 * The text column carries `minWidth: 0` and the icon `flexShrink: 0`. Without that pair the label's
 * longest word sets a floor the card cannot afford at two-up on a 320px phone, and the icon lands
 * on top of the text.
 */
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
      {/* Two lines' worth of height is reserved whether the label needs them or not. At two-up on a
          360px phone "Messages today" wraps and "Contacts" does not, and without this the numbers
          underneath sit at different heights across the row — the one thing a KPI row cannot do,
          since scanning it depends on the numbers sharing a baseline. */}
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
              // Tinted from the semantic colour rather than a new palette key, so it tracks the
              // theme in both schemes: the guide's "colored text on tinted bg" pill.
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
        {/* minWidth:0 on the text and flexShrink:0 on the action: without both, a long subtitle
            pushes the button off the card rather than wrapping. */}
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

  return (
    <PageBody
      title="Workspace overview"
      description="Your customers, conversations and next steps, all in one place."
      actions={<Button component={NextLink} href="/inbox" variant="contained" startIcon={<ForumRoundedIcon />}>Open inbox</Button>}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' }, mb: 3, borderRadius: 3, overflow: 'hidden', bgcolor: '#183E35', color: '#F2FFF6' }}>
        <Box sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="overline" sx={{ color: '#B3D8C7' }}>A LITTLE CLARITY. A LOT MORE POSSIBILITY.</Typography>
          <Typography component="h2" sx={{ fontSize: { xs: '1.875rem', md: '2.5rem' }, lineHeight: 1.15, fontWeight: 650, letterSpacing: '-0.04em', mt: 1, mb: 1.5 }}>Make room for<br />your next big idea.</Typography>
          <Typography variant="body2" sx={{ color: '#C4DED1', maxWidth: 440 }}>Keep the everyday work moving. Connect with customers, follow up on leads and bring your team together.</Typography>
        </Box>
        <Stack spacing={1.5} sx={{ p: { xs: 3, md: 4 }, justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.045)', borderLeft: { md: '1px solid rgba(255,255,255,0.1)' } }}>
          <Typography variant="overline" sx={{ color: '#B3D8C7' }}>PICK UP WHERE IT MATTERS</Typography>
          {[[PeopleAltRoundedIcon, 'Manage your customers', '/contacts'], [CampaignRoundedIcon, 'Plan your next campaign', '/broadcasts']].map(([Icon, label, href]) => (
            <ButtonBase component={NextLink} href={href} key={href} sx={{ p: 1.75, borderRadius: 2, textAlign: 'left', justifyContent: 'space-between', gap: 1, color: '#F2FFF6', border: '1px solid rgba(255,255,255,0.18)', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
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
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography component="h2" variant="h5" fontWeight={750}>Your business toolkit</Typography>
          <Typography variant="caption" color="text.secondary">One connected workspace</Typography>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
          {SERVICES.map((service) => {
            const Icon = service.icon;
            const released = service.status === 'active' || service.status === 'beta';
            const connected = healthBySlug[service.slug]?.connection === 'connected';
            return (
              <Paper key={service.slug} variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', minWidth: 0 }}>
                <ButtonBase component={released ? NextLink : 'div'} href={released ? service.href : undefined} disabled={!released} sx={{ display: 'flex', width: '100%', height: '100%', textAlign: 'left', alignItems: 'flex-start', p: 2.5, gap: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                  <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'action.selected', color: 'primary.main' }}><Icon /></Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={750}>{service.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', my: 0.75 }}>{service.description}</Typography>
                    <Typography variant="caption" sx={{ color: connected ? 'success.main' : 'text.secondary', fontWeight: 650 }}>{!released ? 'Coming soon' : connected ? 'Connected' : service.tier === 'pro' ? 'Explore Pro service' : 'Open workspace'}</Typography>
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

      <Section title="Service health" subtitle="Connection and availability across your business tools.">
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
