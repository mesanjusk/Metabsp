'use client';

import { useEffect, useState } from 'react';
import {
  Alert, AlertTitle, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  IconButton, InputAdornment, Paper, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import apiClient from '@/lib/api/client';
import { toast } from '@/lib/ui/components/Toast';
import { parseApiError } from '@/lib/api/parseApiError';

const copy = async (value, label) => {
  try {
    await navigator.clipboard.writeText(value || '');
    toast.success(`${label} copied.`);
  } catch (_err) {
    toast.error(`Could not copy ${label.toLowerCase()}.`);
  }
};

// Admin-only: the app has exactly one Meta App webhook subscription (Meta
// doesn't support one per user), so this is the single Callback URL/Verify
// Token pair to paste into Meta App Dashboard → WhatsApp → Configuration.
// Shown the same masked-value + reveal/copy pattern Render uses for env vars.
export default function MetaWebhookConfigPanel() {
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [tokenVisible, setTokenVisible] = useState(false);
  const [confirmRepoint, setConfirmRepoint] = useState(false);
  const [isRepointing, setIsRepointing] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/whatsapp/meta-webhook-config');
      setConfig(response?.data?.data || null);
    } catch (err) {
      setError(parseApiError(err, 'Could not load webhook configuration.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const repoint = async () => {
    setIsRepointing(true);
    try {
      const response = await apiClient.post('/api/whatsapp/meta-webhook-config');
      toast.success(response?.data?.message || 'Meta webhook updated.');
      setConfirmRepoint(false);
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not update the webhook subscription.'));
    } finally {
      setIsRepointing(false);
    }
  };

  const comparison = config?.comparison || null;
  const metaUrl = config?.meta?.callbackUrl || '';

  const maskedToken = config?.verifyToken
    ? (tokenVisible ? config.verifyToken : '•'.repeat(Math.min(24, config.verifyToken.length)))
    : '';

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={700}>Meta webhook configuration</Typography>
            <Typography variant="body2" color="text.secondary">
              Paste these into Meta App Dashboard → WhatsApp → Configuration → Webhook. One shared
              value for the whole app — Meta doesn't support a separate webhook per user.
            </Typography>
          </Box>
          <Button startIcon={<RefreshRoundedIcon />} onClick={load} disabled={isLoading}>Refresh</Button>
        </Stack>

        {error ? <Alert severity="warning">{error}</Alert> : null}

        {!error && !isLoading && !config?.verifyToken ? (
          <Alert severity="info">
            WHATSAPP_WEBHOOK_VERIFY_TOKEN isn't set on the server yet. Set it in Render's environment
            variables, then use the same value here and in Meta's dashboard.
          </Alert>
        ) : null}

        {comparison?.state === 'elsewhere' ? (
          <Alert severity="error">
            <AlertTitle>Meta is delivering somewhere else</AlertTitle>
            {comparison.reason} Use the button below to point it here.
          </Alert>
        ) : null}

        {comparison?.state === 'unset' ? (
          <Alert severity="error">
            <AlertTitle>Meta has no callback URL for this app</AlertTitle>
            No inbound message can arrive until one is set.
          </Alert>
        ) : null}

        {comparison?.state === 'same_host' ? (
          <Alert severity="warning">{comparison.reason}</Alert>
        ) : null}

        {comparison?.state === 'match' && config?.meta?.active ? (
          <Alert severity="success">{comparison.reason}</Alert>
        ) : null}

        {config?.meta?.status === 'ok' && !config?.meta?.active ? (
          <Alert severity="error">
            <AlertTitle>Meta has marked this subscription inactive</AlertTitle>
            It stops delivering while that is true, however the URL and fields are set.
          </Alert>
        ) : null}

        {config?.meta?.status && config.meta.status !== 'ok' ? (
          <Alert severity="warning">
            Could not read what Meta currently holds: {config.meta.reason || 'no reason given'}
          </Alert>
        ) : null}

        <TextField
          label="Callback URL"
          value={config?.callbackUrl || ''}
          fullWidth
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Copy">
                  <IconButton onClick={() => copy(config?.callbackUrl, 'Callback URL')} disabled={!config?.callbackUrl}>
                    <ContentCopyRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />

        <TextField
          label="Verify token"
          value={maskedToken}
          fullWidth
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title={tokenVisible ? 'Hide' : 'Reveal'}>
                  <IconButton onClick={() => setTokenVisible((v) => !v)} disabled={!config?.verifyToken}>
                    {tokenVisible ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy">
                  <IconButton onClick={() => copy(config?.verifyToken, 'Verify token')} disabled={!config?.verifyToken}>
                    <ContentCopyRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button
            variant={comparison?.state === 'elsewhere' || comparison?.state === 'unset' ? 'contained' : 'outlined'}
            color={comparison?.state === 'elsewhere' || comparison?.state === 'unset' ? 'error' : 'primary'}
            onClick={() => setConfirmRepoint(true)}
            disabled={isLoading || isRepointing || !config?.verifyToken}
          >
            Point Meta at this deployment
          </Button>
          <Typography variant="caption" color="text.secondary">
            Writes the subscription through the Graph API rather than the dashboard form.
          </Typography>
        </Stack>
      </Stack>

      <Dialog open={confirmRepoint} onClose={() => (isRepointing ? null : setConfirmRepoint(false))} fullWidth maxWidth="sm">
        <DialogTitle>Point Meta at this deployment?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Meta currently delivers to <strong>{metaUrl || '(nothing)'}</strong>. This changes it to{' '}
              <strong>{config?.callbackUrl}</strong>.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This affects the whole Meta app, not one user — Meta stores a single callback URL. Anything else
              relying on the old URL stops receiving WhatsApp webhooks. Meta verifies the new URL before storing
              it, so a wrong verify token fails here rather than quietly later.
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRepoint(false)} disabled={isRepointing}>Cancel</Button>
          <Button variant="contained" onClick={repoint} disabled={isRepointing}>
            {isRepointing ? 'Updating…' : 'Point it here'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
