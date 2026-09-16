'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import NextLink from 'next/link';
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Tooltip as MuiTooltip,
  Typography,
  useTheme,
} from '@mui/material';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import CurrencyRupeeRoundedIcon from '@mui/icons-material/CurrencyRupeeRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';
import { INSTITUTE_FEATURES } from '@/lib/institute/featureRegistry';
import { chartPalette, typeScale } from '@/lib/ui/tokens';

/**
 * Recharts is a third of this page's JavaScript and none of it is needed for the numbers above the
 * fold, so the figures arrive after the page does.
 */
const HorizontalBars = dynamic(() => import('@/lib/ui/charts/HorizontalBars'), {
  ssr: false,
  loading: () => <Skeleton variant="rounded" height={180} sx={{ borderRadius: 2 }} />,
});

const count = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const money = (value) => `₹${count.format(Math.round(Number(value || 0)))}`;

/**
 * Lakhs and crores, for the hero numbers only.
 *
 * A KPI tile is half a phone screen wide, and a fee balance written in full — ₹18,42,300 — does
 * not fit one at hero size: it rendered as "₹4,…". The figures that have room to be exact stay
 * exact (the fee card below prints both to the rupee), and the tile carries the full amount in its
 * tooltip.
 */
function compactMoney(value) {
  const amount = Math.round(Number(value || 0));
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2).replace(/\.?0+$/, '')}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2).replace(/\.?0+$/, '')}L`;
  return money(amount);
}

/**
 * Entity types come back as registry slugs; the registry already has a human name for each.
 *
 * Several tools share one resource — `students` is read by the student list, by CSV import and by
 * bulk download — so the name has to come from the tool that *is* the records screen. Taking the
 * last match instead labelled the student count "Bulk Download" and the fee count "Student
 * Balance".
 */
const LABEL_BY_RESOURCE = Object.fromEntries(
  INSTITUTE_FEATURES.filter((feature) => feature.resource)
    // Records screens last, so they overwrite the reports and importers that share their resource.
    .sort((a, b) => Number(a.kind === 'records') - Number(b.kind === 'records'))
    .map((feature) => [feature.resource, feature.label])
);
const moduleLabel = (key) =>
  LABEL_BY_RESOURCE[key] || String(key || '').replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());

function Kpi({ icon: Icon, label, value, exact, hint }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, minWidth: 0 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block' }}>
            {label}
          </Typography>
          <Typography
            component="p"
            fontWeight={800}
            noWrap
            title={exact || undefined}
            sx={{ fontSize: { xs: '1.625rem', md: typeScale.kpi }, lineHeight: 1.15, mt: 0.5 }}
          >
            {value}
          </Typography>
          {hint ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
              {hint}
            </Typography>
          ) : null}
        </Box>
        {/* Decorative: the label already names the measure, and on a phone the icon is what pushes
            "Fees outstanding" onto two lines. */}
        <Box sx={{ display: { xs: 'none', sm: 'grid' }, width: 40, height: 40, borderRadius: 2, bgcolor: 'action.hover', placeItems: 'center', flexShrink: 0 }}>
          <Icon fontSize="small" />
        </Box>
      </Stack>
    </Paper>
  );
}

function Figure({ title, caption, children, action }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 1.75 }}>
        <Box minWidth={0}>
          <Typography variant="subtitle1" fontWeight={750}>{title}</Typography>
          {caption ? <Typography variant="caption" color="text.secondary">{caption}</Typography> : null}
        </Box>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

/**
 * Collected against outstanding, as one bar.
 *
 * Two numbers that sum to a whole is the one case where a bar beats a chart: the point is the
 * share, and the share is legible without an axis. Both segments carry a visible label because
 * the amber step does not clear 3:1 against a white card on its own.
 */
function CollectionMeter({ collected, balance, palette }) {
  const total = Number(collected || 0) + Number(balance || 0);
  const pct = total > 0 ? Math.round((Number(collected || 0) / total) * 100) : 0;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="baseline" spacing={1}>
        <Typography component="p" fontWeight={800} sx={{ fontSize: typeScale.kpi, lineHeight: 1.1 }}>{pct}%</Typography>
        <Typography variant="body2" color="text.secondary">of {money(total)} billed has been collected</Typography>
      </Stack>

      <MuiTooltip title={`${money(collected)} collected · ${money(balance)} outstanding`}>
        <Box
          role="img"
          aria-label={`${pct}% collected: ${money(collected)} of ${money(total)}`}
          sx={{ display: 'flex', gap: '2px', height: 14, borderRadius: 999, overflow: 'hidden', bgcolor: palette.track }}
        >
          <Box sx={{ width: `${pct}%`, bgcolor: palette.series[0] }} />
          <Box sx={{ flex: 1, bgcolor: palette.series[1] }} />
        </Box>
      </MuiTooltip>

      <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
        {[
          { label: 'Collected', value: collected, color: palette.series[0] },
          { label: 'Outstanding', value: balance, color: palette.series[1] },
        ].map((row) => (
          <Stack key={row.label} direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: row.color, flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700}>{row.label}</Typography>
            <Typography variant="caption" fontWeight={700}>{money(row.value)}</Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

export default function InstituteOverviewPage() {
  const theme = useTheme();
  const palette = chartPalette(theme.palette.mode);

  const [overview, setOverview] = useState({ kpis: {}, counts: {}, recent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiClient
      .get('/api/institute/overview')
      .then((response) => {
        if (active) setOverview(response?.data?.data || { kpis: {}, counts: {}, recent: [] });
      })
      .catch((e) => {
        if (active) setError(e?.response?.data?.message || 'Could not load the institute overview.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const k = overview?.kpis || {};

  /**
   * A snapshot, not a conversion funnel.
   *
   * The overview counts the records that exist *now* — open enquiries, admissions on file,
   * enrolled students — and nothing in the data says which admission came from which enquiry. A
   * ratio between these three is arithmetic without a meaning: an institute that converts every
   * enquiry it receives reports few open ones and many admissions, and dividing the second by the
   * first announced "209% conversion". So the bars are labelled for what they are.
   */
  const pipeline = useMemo(
    () => [
      { label: 'Open enquiries', value: Number(k.leads || 0) },
      { label: 'Admissions', value: Number(k.admissions || 0) },
      { label: 'Students', value: Number(k.students || 0) },
    ],
    [k.leads, k.admissions, k.students]
  );

  const modules = useMemo(() => {
    const counts = overview?.counts || {};
    return Object.entries(counts)
      .map(([key, value]) => ({ label: moduleLabel(key), value: Number(value || 0) }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [overview?.counts]);

  const recent = Array.isArray(overview?.recent) ? overview.recent : [];
  const hasAnything = pipeline.some((row) => row.value > 0) || modules.length > 0
    || Number(k.feesCollected || 0) > 0 || Number(k.feeBalance || 0) > 0;

  return (
    <PageBody
      title="Institute overview"
      description="How admissions, fees and records are moving. Every institute tool lives in the menu on the left."
      actions={
        <Button component={NextLink} href="/services/institute/add-admission" variant="contained" size="small">
          New admission
        </Button>
      }
    >
      {error ? <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert> : null}

      {loading ? (
        <Stack spacing={3}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' }, gap: 2 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={112} sx={{ borderRadius: 3 }} />)}
          </Box>
          <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
        </Stack>
      ) : (
        <Stack spacing={3}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' }, gap: 2 }}>
            <Kpi icon={PeopleAltRoundedIcon} label="Students" value={count.format(Number(k.students || 0))} hint={`${count.format(Number(k.batches || 0))} batches`} />
            <Kpi icon={PersonAddAltRoundedIcon} label="Open enquiries" value={count.format(Number(k.leads || 0))} hint="Awaiting follow-up" />
            <Kpi icon={SchoolRoundedIcon} label="Admissions" value={count.format(Number(k.admissions || 0))} hint={`${count.format(Number(k.courses || 0))} courses offered`} />
            <Kpi
              icon={CurrencyRupeeRoundedIcon}
              label="Fees outstanding"
              value={compactMoney(k.feeBalance)}
              exact={money(k.feeBalance)}
              hint={`${compactMoney(k.feesCollected)} collected`}
            />
          </Box>

          {!hasAnything ? (
            <Paper variant="outlined" sx={{ borderRadius: 3, p: 4 }}>
              <Stack spacing={1.5} alignItems="flex-start">
                <Typography variant="subtitle1" fontWeight={750}>Nothing to report yet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
                  This page fills in as the institute is used. Open a tool from the menu on the left — start with an
                  enquiry or an admission — and the numbers, the pipeline and the fee position appear here.
                </Typography>
                <Button component={NextLink} href="/services/institute/add-lead" variant="outlined" size="small">
                  Add the first enquiry
                </Button>
              </Stack>
            </Paper>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
              <Figure
                title="Fee position"
                caption="Against everything billed to date."
              >
                <CollectionMeter collected={k.feesCollected} balance={k.feeBalance} palette={palette} />
                <Divider sx={{ mt: 'auto', pt: 2, mb: 2 }} />
                <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                  <Stat label="Courses" value={count.format(Number(k.courses || 0))} icon={MenuBookRoundedIcon} />
                  <Stat label="Batches" value={count.format(Number(k.batches || 0))} icon={GroupsRoundedIcon} />
                  <Stat label="Employees" value={count.format(Number(k.employees || 0))} icon={BadgeRoundedIcon} />
                </Stack>
              </Figure>

              <Figure
                title="Admission pipeline"
                caption="How many records stand at each stage today."
              >
                <HorizontalBars data={pipeline} palette={palette} height={200} />
              </Figure>

              {modules.length ? (
                <Figure title="Records by module" caption="The eight modules holding the most records.">
                  <HorizontalBars data={modules} palette={palette} height={Math.max(200, modules.length * 38)} />
                </Figure>
              ) : null}

              <Figure
                title="Recent activity"
                caption="The records touched most recently."
              >
                {recent.length ? (
                  <Stack divider={<Divider flexItem />} sx={{ mt: -1 }}>
                    {recent.map((item) => (
                      <Stack key={item._id || item.legacyId} direction="row" justifyContent="space-between" spacing={2} sx={{ py: 1.25, minWidth: 0 }}>
                        <Box minWidth={0}>
                          <Typography variant="body2" fontWeight={650} noWrap>{recordName(item)}</Typography>
                          <Typography variant="caption" color="text.secondary">{moduleLabel(item.entityType)}</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, pt: 0.25 }}>
                          {whenText(item.updatedAt)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">No records have been updated yet.</Typography>
                )}
              </Figure>
            </Box>
          )}
        </Stack>
      )}
    </PageBody>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Icon fontSize="small" sx={{ color: 'text.secondary' }} />
      <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
      <Typography variant="caption" fontWeight={800}>{value}</Typography>
    </Stack>
  );
}

function recordName(item) {
  const p = item?.payload || {};
  return (
    p.name
    || [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')
    || p.studentName
    || p.course
    || p.exam
    || item?.legacyId
    || 'Record'
  );
}

function whenText(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime()) || !value) return '';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
