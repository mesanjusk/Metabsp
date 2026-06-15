import { useEffect, useState } from 'react';
import { Alert, Box, Button, Paper, Stack, Switch, TextField, Typography, FormControlLabel } from '@mui/material';
import PropTypes from 'prop-types';
import apiClient from '../../apiClient';
import { parseApiError } from '../../utils/parseApiError';

const defaultConfig = {
  analyticsEnabled: true,
  autoReplyEnabled: true,
  webhookHealthAlerts: false,
  defaultCountryCode: '+1',
  timezone: 'UTC',
};

export default function WhatsAppAttendanceSettings({
  whatsappAccount,
  isAccountConnected,
  isAccountLoading,
  onConnect,
  onDisconnect,
  onRefreshAccount,
  onManualConnect,
  onReconnect,
  whatsappAccountStatus,
  accountConnectionMode,
  accountActionLoading,
}) {
  const [form, setForm] = useState(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/whatsapp/settings');
      const data = response?.data?.data || response?.data || {};
      setForm({ ...defaultConfig, ...data });
    } catch (err) {
      setError(parseApiError(err, 'Settings endpoint unavailable. You can still use chats/templates/broadcast.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      await apiClient.post('/api/whatsapp/settings', form);
      setMessage('Settings saved successfully.');
    } catch (err) {
      setError(parseApiError(err, 'Could not save settings.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" fontWeight={700}>WhatsApp Settings</Typography>
          <Typography variant="body2" color="text.secondary">Optional settings and analytics toggles. Hidden backend features fail gracefully.</Typography>
        </Box>

        <Alert severity={isAccountConnected ? 'success' : 'info'}>
          <Stack spacing={0.5}>
            <Typography variant="body2" fontWeight={600}>
              {isAccountConnected ? 'WhatsApp account connected' : 'No WhatsApp account connected'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isAccountConnected
                ? `${whatsappAccount?.verified_name || whatsappAccount?.display_name || 'Business account'} • ${whatsappAccount?.phone_number || whatsappAccount?.display_phone_number || 'Number unavailable'}`
                : 'Connect your WhatsApp account to enable chats, templates, and broadcast.'}
            </Typography>
            {(whatsappAccountStatus || accountConnectionMode) ? (
              <Typography variant="caption" color="text.secondary">
                {[
                  whatsappAccountStatus ? `Status: ${whatsappAccountStatus}` : null,
                  accountConnectionMode ? `Mode: ${accountConnectionMode}` : null,
                ].filter(Boolean).join(' • ')}
              </Typography>
            ) : null}
          </Stack>
        </Alert>

        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Button variant="outlined" onClick={onRefreshAccount} disabled={isAccountLoading || accountActionLoading}>
            {isAccountLoading ? 'Checking...' : 'Refresh account'}
          </Button>
          <Button variant="contained" onClick={onConnect} disabled={accountActionLoading}>
            Connect with Meta
          </Button>
          <Button variant="text" onClick={onManualConnect} disabled={accountActionLoading}>
            Connect manually
          </Button>
          {whatsappAccount?.id ? (
            <Button variant="outlined" onClick={onReconnect} disabled={accountActionLoading}>
              Reconnect
            </Button>
          ) : null}
          {isAccountConnected && whatsappAccount?.id ? (
            <Button color="error" variant="text" onClick={() => onDisconnect(whatsappAccount.id)} disabled={accountActionLoading}>
              Disconnect
            </Button>
          ) : null}
        </Stack>

        {message ? <Alert severity="success">{message}</Alert> : null}
        {error ? <Alert severity="warning">{error}</Alert> : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControlLabel control={<Switch checked={Boolean(form.analyticsEnabled)} onChange={(e) => setForm((prev) => ({ ...prev, analyticsEnabled: e.target.checked }))} />} label="Enable analytics" />
          <FormControlLabel control={<Switch checked={Boolean(form.autoReplyEnabled)} onChange={(e) => setForm((prev) => ({ ...prev, autoReplyEnabled: e.target.checked }))} />} label="Enable auto reply" />
          <FormControlLabel control={<Switch checked={Boolean(form.webhookHealthAlerts)} onChange={(e) => setForm((prev) => ({ ...prev, webhookHealthAlerts: e.target.checked }))} />} label="Webhook alerts" />
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <TextField label="Default country code" value={form.defaultCountryCode || ''} onChange={(e) => setForm((prev) => ({ ...prev, defaultCountryCode: e.target.value }))} />
          <TextField label="Timezone" value={form.timezone || ''} onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))} />
        </Stack>

        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button variant="outlined" onClick={load} disabled={isLoading || isSaving}>Reload</Button>
          <Button variant="contained" onClick={save} disabled={isLoading || isSaving}>{isSaving ? 'Saving...' : 'Save settings'}</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

WhatsAppAttendanceSettings.propTypes = {
  whatsappAccount: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    verified_name: PropTypes.string,
    display_name: PropTypes.string,
    phone_number: PropTypes.string,
    display_phone_number: PropTypes.string,
  }),
  isAccountConnected: PropTypes.bool,
  isAccountLoading: PropTypes.bool,
  onConnect: PropTypes.func,
  onDisconnect: PropTypes.func,
  onRefreshAccount: PropTypes.func,
  onManualConnect: PropTypes.func,
  onReconnect: PropTypes.func,
  whatsappAccountStatus: PropTypes.string,
  accountConnectionMode: PropTypes.string,
  accountActionLoading: PropTypes.bool,
};

WhatsAppAttendanceSettings.defaultProps = {
  whatsappAccount: null,
  isAccountConnected: false,
  isAccountLoading: false,
  onConnect: () => {},
  onDisconnect: () => {},
  onRefreshAccount: () => {},
  onManualConnect: () => {},
  onReconnect: () => {},
  whatsappAccountStatus: '',
  accountConnectionMode: '',
  accountActionLoading: false,
};
