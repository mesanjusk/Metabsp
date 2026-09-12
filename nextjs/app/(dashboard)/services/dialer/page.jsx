'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded';
import CallReceivedRoundedIcon from '@mui/icons-material/CallReceivedRounded';
import CallMadeRoundedIcon from '@mui/icons-material/CallMadeRounded';
import CallMissedRoundedIcon from '@mui/icons-material/CallMissedRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

const PROVIDER_REPO = 'https://github.com/mesanjusk/BusinessCallManager';

function MetricCard({ label, value }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
      <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>{Number(value || 0).toLocaleString('en-IN')}</Typography>
    </Paper>
  );
}

// The provider stores call `type` as a device-native string. Map the common
// Android CallLog values (and their numeric codes) onto a direction + icon.
function callDirection(type) {
  const value = String(type || '').trim().toLowerCase();
  if (value === 'incoming' || value === '1') return { label: 'Incoming', Icon: CallReceivedRoundedIcon, color: 'success.main' };
  if (value === 'outgoing' || value === '2') return { label: 'Outgoing', Icon: CallMadeRoundedIcon, color: 'primary.main' };
  if (value === 'missed' || value === '3') return { label: 'Missed', Icon: CallMissedRoundedIcon, color: 'error.main' };
  return { label: type ? String(type) : 'Call', Icon: PhoneInTalkRoundedIcon, color: 'text.secondary' };
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return '—';
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return mins ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatWhen(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  return new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function DialerServicePage() {
  const [summary, setSummary] = useState({});
  const [queue, setQueue] = useState([]);
  const [logs, setLogs] = useState([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryResponse, recordsResponse, logsResponse] = await Promise.all([
        apiClient.get('/api/smb/summary'),
        apiClient.get('/api/smb/records', { params: { kind: 'lead,followup', limit: 150 } }),
        apiClient.post('/api/services/dialer/call-logs', {}),
      ]);
      setSummary(summaryResponse?.data?.data || {});
      const records = recordsResponse?.data?.data || [];
      // The call queue is every open lead or follow-up that actually has a
      // phone number to dial — drawn from the shared CRM records, so the
      // dialer never introduces a second customer database.
      setQueue(records.filter((record) => record?.contactId?.phone));
      setConfigured(Boolean(logsResponse?.data?.data?.configured));
      setLogs(logsResponse?.data?.data?.logs || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not load the dialer workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const metrics = useMemo(
    () => [
      ['Open leads', summary.leadsOpen],
      ['Follow-ups due', summary.followupsDue],
      ['In call queue', queue.length],
      ['Calls logged', logs.length],
    ],
    [summary, queue.length, logs.length]
  );

  return (
    <PageBody
      title="Business Dialer"
      description="Lead calling, click-to-dial and synced call history — powered by the Business Call Manager app on the same shared customer records."
    >
      <Stack spacing={2.5}>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 48, height: 48, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}>
                  <PhoneInTalkRoundedIcon />
                </Box>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h6" fontWeight={800}>Business Call Manager</Typography>
                    <Chip
                      size="small"
                      color={configured ? 'success' : 'default'}
                      variant={configured ? 'filled' : 'outlined'}
                      label={configured ? 'Connected' : 'Provider not connected'}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Install the QuickLink Caller app on the team&apos;s phones to place calls and sync call logs back here.
                  </Typography>
                </Box>
              </Stack>
              <Button
                component={MuiLink}
                href={PROVIDER_REPO}
                target="_blank"
                rel="noreferrer noopener"
                variant="outlined"
                endIcon={<ArrowForwardRoundedIcon />}
              >
                Get the app
              </Button>
            </Stack>
            {!configured ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                Set <code>BUSINESS_CALL_MANAGER_API_URL</code> to your Business Call Manager backend to sync call history.
                Until then you can still dial leads below — every tap opens your device&apos;s dialer.
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', lg: 'repeat(4,minmax(0,1fr))' }, gap: 1.25 }}>
          {metrics.map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}
        </Box>

        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Call queue</Typography>
                <Typography variant="caption" color="text.secondary">Open leads and due follow-ups with a phone number. Tap to dial.</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={load}>Refresh</Button>
                <Button size="small" component={NextLink} href="/services/crm" endIcon={<ArrowForwardRoundedIcon />}>Open CRM</Button>
              </Stack>
            </Stack>
            <Divider sx={{ mb: 1 }} />
            {loading ? (
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ py: 4 }}>
                <CircularProgress size={20} /><Typography variant="body2">Loading…</Typography>
              </Stack>
            ) : queue.length ? (
              <Stack>
                {queue.map((record) => {
                  const contact = record.contactId || {};
                  const phone = String(contact.phone || '');
                  return (
                    <Stack
                      key={record._id}
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      justifyContent="space-between"
                      alignItems={{ sm: 'center' }}
                      sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                          <Typography variant="body2" fontWeight={800}>{contact.name || phone}</Typography>
                          <Chip size="small" variant="outlined" label={record.kind === 'lead' ? 'Lead' : 'Follow-up'} />
                          {record.status ? <Chip size="small" variant="outlined" label={record.status} /> : null}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {[phone, record.title, record.dueAt ? `Due: ${new Date(record.dueAt).toLocaleString('en-IN')}` : ''].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<PhoneInTalkRoundedIcon />}
                        component={MuiLink}
                        href={`tel:${phone}`}
                      >
                        Call
                      </Button>
                    </Stack>
                  );
                })}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No leads or follow-ups with a phone number yet. Add them in the CRM to build your call list.
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={800}>Recent call history</Typography>
            <Typography variant="caption" color="text.secondary">Synced from the Business Call Manager app.</Typography>
            <Divider sx={{ my: 1 }} />
            {loading ? (
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ py: 4 }}>
                <CircularProgress size={20} /><Typography variant="body2">Loading…</Typography>
              </Stack>
            ) : logs.length ? (
              <Stack>
                {logs.slice(0, 50).map((log, index) => {
                  const { label, Icon, color } = callDirection(log.type);
                  return (
                    <Stack
                      key={log._id || log.id || `${log.number}-${log.date}-${index}`}
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <Box sx={{ color, display: 'grid', placeItems: 'center' }}><Icon fontSize="small" /></Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight={750} noWrap>{log.cachedName || log.number || 'Unknown'}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {[label, log.number, formatDuration(log.duration), log.callNote].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{formatWhen(log.date)}</Typography>
                    </Stack>
                  );
                })}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                {configured ? 'No calls synced in the last 30 days.' : 'Connect the Business Call Manager backend to see synced call history here.'}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Stack>
    </PageBody>
  );
}
