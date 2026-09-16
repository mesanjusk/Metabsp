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
  Typography,
  useTheme,
} from '@mui/material';
import apiClient from '@/lib/api/client';
import { chartPalette, typeScale } from '@/lib/ui/tokens';
import { getSmbService, SMB_KINDS, smbRecordHref } from '@/lib/smb/workspaceRegistry';
import BusinessCopilot from './BusinessCopilot';

const HorizontalBars = dynamic(() => import('@/lib/ui/charts/HorizontalBars'), {
  ssr: false,
  loading: () => <Skeleton variant="rounded" height={180} sx={{ borderRadius: 2 }} />,
});

const count = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const money = (paise) => `₹${count.format(Math.round(Number(paise || 0) / 100))}`;

/** Lakhs and crores, so a rupee hero number fits half a phone screen. */
function compactMoney(paise) {
  const rupees = Math.round(Number(paise || 0) / 100);
  const sign = rupees < 0 ? '-' : '';
  const abs = Math.abs(rupees);
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2).replace(/\.?0+$/, '')}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2).replace(/\.?0+$/, '')}L`;
  return `₹${count.format(rupees)}`;
}

function Kpi({ label, value, exact, hint }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block' }}>{label}</Typography>
      <Typography
        component="p"
        fontWeight={800}
        noWrap
        title={exact || undefined}
        sx={{ fontSize: { xs: '1.625rem', md: typeScale.kpi }, lineHeight: 1.15, mt: 0.5, color: 'primary.main', letterSpacing: '-0.035em' }}
      >
        {value}
      </Typography>
      {hint ? <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>{hint}</Typography> : null}
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

function whenText(value) {
  const date = new Date(value || 0);
  if (!value || Number.isNaN(date.getTime())) return '';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * A small-business service's main screen.
 *
 * It answers "how is this part of the business doing" and nothing else. The record kinds it used
 * to carry as tabs are screens of their own now, reached from the sidebar — so this page is free
 * to be the overview every other service in the product has.
 */
export default function SmbOverview({ service }) {
  const theme = useTheme();
  const palette = chartPalette(theme.palette.mode);
  const config = getSmbService(service);

  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiClient
      .get('/api/smb/summary')
      .then((response) => { if (active) setSummary(response?.data?.data || {}); })
      .catch((e) => { if (active) setError(e?.response?.data?.message || 'Could not load this workspace.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const bars = useMemo(
    () => (config?.figure?.rows || []).map(([label, key]) => ({ label, value: Number(summary[key] || 0) })),
    [config, summary]
  );

  if (!config) return <Alert severity="warning">This small-business workspace is not configured.</Alert>;

  const recent = Array.isArray(summary?.recent) ? summary.recent : [];
  const hasAnything = bars.some((row) => row.value > 0) || recent.length > 0;

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <Stack spacing={3}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' }, gap: 2 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={104} sx={{ borderRadius: 3 }} />)}
          </Box>
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: 3 }} />
        </Stack>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' }, gap: 2 }}>
            {config.metrics.map(([label, key, format]) => (
              <Kpi
                key={key}
                label={label}
                value={format === 'money' ? compactMoney(summary[key]) : count.format(Number(summary[key] || 0))}
                exact={format === 'money' ? money(summary[key]) : undefined}
              />
            ))}
          </Box>

          {!hasAnything ? (
            <Paper variant="outlined" sx={{ borderRadius: 3, p: 4 }}>
              <Stack spacing={1.5} alignItems="flex-start">
                <Typography variant="subtitle1" fontWeight={750}>Nothing to report yet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
                  {config.description} This page fills in as you use it — open a screen from the menu on the left and add the first record.
                </Typography>
                <Button component={NextLink} href={smbRecordHref(service, config.kinds[0])} variant="contained" size="small">
                  Add a {String(SMB_KINDS[config.kinds[0]]?.label || config.kinds[0]).toLowerCase().replace(/s$/, '')}
                </Button>
              </Stack>
            </Paper>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
              {bars.length ? (
                <Figure title={config.figure.title} caption={config.figure.caption}>
                  <HorizontalBars
                    data={bars}
                    palette={palette}
                    height={Math.max(180, bars.length * 56)}
                    formatValue={config.figure.format === 'money' ? compactMoney : undefined}
                  />
                </Figure>
              ) : null}

              <Figure
                title="Recent activity"
                caption="The records touched most recently, across the workspace."
              >
                {recent.length ? (
                  <Stack divider={<Divider flexItem />} sx={{ mt: -1 }}>
                    {recent.map((item) => (
                      <Stack key={item._id} direction="row" justifyContent="space-between" spacing={2} sx={{ py: 1.25, minWidth: 0 }}>
                        <Box minWidth={0}>
                          <Typography variant="body2" fontWeight={650} noWrap>{item.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {SMB_KINDS[item.kind]?.label || item.kind}
                            {item.contactId?.name ? ` · ${item.contactId.name}` : ''}
                          </Typography>
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
        </>
      )}

      <BusinessCopilot />
    </Stack>
  );
}
