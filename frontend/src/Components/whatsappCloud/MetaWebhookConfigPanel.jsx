import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, IconButton, InputAdornment, Paper, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import apiClient from '../../apiClient';
import { toast } from '../Toast';
import { parseApiError } from '../../utils/parseApiError';

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
      </Stack>
    </Paper>
  );
}
