'use client';

import { useEffect, useState } from 'react';
import {
  Alert, AlertTitle, Box, Button, Chip, Divider, Paper, Stack, Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import apiClient from '@/lib/api/client';
import { parseApiError } from '@/lib/api/parseApiError';

// The five stages an inbound message crosses, in delivery order, matching the
// check ids returned by lib/services/webhookDiagnosticsService.ts. Titles are
// phrased as the question each stage answers, because the panel is read by
// someone who already knows the symptom and needs to know where it breaks.
const STAGE_TITLES = {
  endpoint_config: 'Can this deployment accept a delivery?',
  meta_subscription: 'What has Meta been told to send, and where?',
  waba_subscriptions: 'Is this app attached to each connected WABA?',
  delivery: 'What has actually arrived here?',
  queue: 'Is anything processing what arrives?',
  inbox: 'Do processed messages land somewhere visible?',
};

const SEVERITY_COLOR = { ok: 'success', info: 'info', warn: 'warning', error: 'error' };
const SEVERITY_LABEL = { ok: 'OK', info: 'Info', warn: 'Check', error: 'Broken' };

const formatWhen = (value) => (value ? new Date(value).toLocaleString() : 'never');

function StageRow({ check }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Chip
          size="small"
          label={SEVERITY_LABEL[check.severity] || check.severity}
          color={SEVERITY_COLOR[check.severity] || 'default'}
          variant={check.severity === 'ok' ? 'outlined' : 'filled'}
        />
        <Typography variant="subtitle2" fontWeight={700}>
          {STAGE_TITLES[check.id] || check.id}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">{check.summary}</Typography>

      {/* Per-number receipt times: the one detail a summary cannot carry, and
          the fastest way to see that one connected number receives and
          another never has. */}
      {check.id === 'inbox' && check.accounts?.length ? (
        <Stack spacing={0.25} sx={{ mt: 1 }}>
          {check.accounts.map((account) => (
            <Typography key={account.accountId} variant="caption" color="text.secondary">
              {account.displayPhoneNumber || account.phoneNumberId || account.accountId}
              {' — last webhook '}
              {formatWhen(account.lastWebhookAt)}
              {account.status ? ` (${account.status})` : ''}
            </Typography>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}

/**
 * Admin-only read-out of why inbound messages are or are not reaching the
 * inbox. Sits beside MetaWebhookConfigPanel because the two are used
 * together: that panel is what you paste into Meta, this one is what tells
 * you whether pasting it worked.
 */
export default function WebhookDeliveryPanel() {
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/whatsapp/webhook-diagnostics');
      setReport(response?.data?.data || null);
    } catch (err) {
      setError(parseApiError(err, 'Could not run webhook diagnostics.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={700}>Inbound message delivery</Typography>
            <Typography variant="body2" color="text.secondary">
              A saved webhook subscription is not proof that messages arrive. This walks the whole path —
              what Meta sends, what reaches this deployment, what processes it, and where it lands.
            </Typography>
          </Box>
          <Button startIcon={<RefreshRoundedIcon />} onClick={load} disabled={isLoading}>Re-check</Button>
        </Stack>

        {error ? <Alert severity="warning">{error}</Alert> : null}

        {report?.firstFailure ? (
          <Alert severity="error">
            <AlertTitle>Fix this first</AlertTitle>
            {report.firstFailure.summary}
          </Alert>
        ) : null}

        {report && !report.firstFailure && report.severity === 'ok' ? (
          <Alert severity="success">
            Every stage checks out. If a specific customer&apos;s message is still missing, it is not the
            webhook path — look at that conversation rather than this configuration.
          </Alert>
        ) : null}

        {report?.checks?.length ? (
          <Stack spacing={2} divider={<Divider flexItem />}>
            {report.checks.map((check) => <StageRow key={check.id} check={check} />)}
          </Stack>
        ) : null}

        {report?.checkedAt ? (
          <Typography variant="caption" color="text.secondary">
            Checked {new Date(report.checkedAt).toLocaleString()}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}
