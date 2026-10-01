'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SmsRoundedIcon from '@mui/icons-material/SmsRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

const emptySettings = {
  agent: {
    agentId: '',
    displayName: '',
    region: 'asia',
    useCase: 'MULTI_USE',
    fallbackMode: 'none',
  },
  runtime: {
    serviceAccountConfigured: false,
    webhookTokenConfigured: false,
    smsFallbackConfigured: false,
  },
  webhookUrl: '',
};

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

export default function RcsMessagingPage() {
  const [settings, setSettings] = useState(emptySettings);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [capPhone, setCapPhone] = useState('');
  const [capability, setCapability] = useState(null);

  const [sendPhone, setSendPhone] = useState('');
  const [sendText, setSendText] = useState('');
  const [trafficType, setTrafficType] = useState('TRANSACTION');

  const [campaignRecipients, setCampaignRecipients] = useState('');
  const [campaignText, setCampaignText] = useState('');
  const [campaignTraffic, setCampaignTraffic] = useState('PROMOTION');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [campaignResult, setCampaignResult] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsResponse, messagesResponse] = await Promise.all([
        apiClient.get('/api/rcs/settings'),
        apiClient.get('/api/rcs/messages'),
      ]);
      const data = settingsResponse?.data?.data || emptySettings;
      setSettings({
        ...emptySettings,
        ...data,
        agent: { ...emptySettings.agent, ...(data.agent || {}) },
        runtime: { ...emptySettings.runtime, ...(data.runtime || {}) },
      });
      setMessages(messagesResponse?.data?.data || []);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not load the RCS workspace.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runtimeReady = settings.runtime.serviceAccountConfigured && settings.runtime.webhookTokenConfigured;
  const agentReady = Boolean(settings.agent?.agentId);

  const updateAgent = (field, value) => {
    setSettings((current) => ({
      ...current,
      agent: { ...(current.agent || emptySettings.agent), [field]: value },
    }));
  };

  const saveAgent = async () => {
    setBusy('save');
    setError('');
    setNotice('');
    try {
      const response = await apiClient.patch('/api/rcs/settings', settings.agent);
      setSettings((current) => ({ ...current, agent: response?.data?.data || current.agent }));
      setNotice('RCS agent settings saved.');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Could not save RCS agent settings.'));
    } finally {
      setBusy('');
    }
  };

  const checkCapability = async () => {
    setBusy('capability');
    setError('');
    setCapability(null);
    try {
      const response = await apiClient.post('/api/rcs/capabilities', { phone: capPhone });
      setCapability(response?.data?.data || null);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Capability check failed.'));
    } finally {
      setBusy('');
    }
  };

  const sendMessage = async () => {
    setBusy('send');
    setError('');
    setNotice('');
    try {
      const response = await apiClient.post('/api/rcs/messages', {
        phone: sendPhone,
        text: sendText,
        trafficType,
      });
      const channel = response?.data?.data?.channel || 'RCS';
      setNotice(`Message sent through ${String(channel).toUpperCase()}.`);
      setSendText('');
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Message send failed.'));
    } finally {
      setBusy('');
    }
  };

  const runCampaign = async () => {
    setBusy('campaign');
    setError('');
    setCampaignResult(null);
    try {
      const recipients = campaignRecipients
        .split(/[\n,;]+/)
        .map((value) => value.trim())
        .filter(Boolean);

      const response = await apiClient.post('/api/rcs/campaigns', {
        recipients,
        text: campaignText,
        trafficType: campaignTraffic,
        consentConfirmed,
      });
      setCampaignResult(response?.data?.data || null);
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Campaign send failed.'));
    } finally {
      setBusy('');
    }
  };

  const copyWebhook = async () => {
    if (!settings.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(settings.webhookUrl);
      setNotice('Webhook URL copied.');
    } catch {
      setNotice('');
    }
  };

  const statusChips = useMemo(
    () => [
      ['Agent', agentReady],
      ['Google service account', settings.runtime.serviceAccountConfigured],
      ['Signed webhook', settings.runtime.webhookTokenConfigured],
      ['SMS adapter', settings.runtime.smsFallbackConfigured],
    ],
    [agentReady, settings.runtime]
  );

  return (
    <PageBody
      title="RCS Messaging"
      description="Google RCS for Business messaging with capability checks, campaigns, inbound events, delivery/read status and safe WhatsApp or SMS fallback."
      actions={
        <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={load} disabled={loading}>
          Refresh
        </Button>
      }
    >
      <Stack spacing={2.5}>
        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
        {notice ? <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert> : null}

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 48, height: 48, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}>
                  <SmsRoundedIcon />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800}>Google RCS for Business</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure one RBM agent for this workspace. Credentials stay in Render environment variables.
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {statusChips.map(([label, ok]) => (
                  <Chip key={label} size="small" color={ok ? 'success' : 'default'} variant={ok ? 'filled' : 'outlined'} label={`${label}: ${ok ? 'Ready' : 'Pending'}`} />
                ))}
              </Stack>
            </Stack>

            {!runtimeReady ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Add the RCS service-account JSON and webhook client token in Render before live sending. You can save the agent details now.
              </Alert>
            ) : null}

            <Divider sx={{ my: 2.5 }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 2 }}>
              <TextField
                label="Agent ID"
                value={settings.agent?.agentId || ''}
                onChange={(e) => updateAgent('agentId', e.target.value)}
                placeholder="Your Google RBM agent ID"
                fullWidth
              />
              <TextField
                label="Display name"
                value={settings.agent?.displayName || ''}
                onChange={(e) => updateAgent('displayName', e.target.value)}
                placeholder="Sanju SK"
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Hosting region</InputLabel>
                <Select label="Hosting region" value={settings.agent?.region || 'asia'} onChange={(e) => updateAgent('region', e.target.value)}>
                  <MenuItem value="asia">Asia Pacific</MenuItem>
                  <MenuItem value="europe">Europe</MenuItem>
                  <MenuItem value="us">North America</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Use case</InputLabel>
                <Select label="Use case" value={settings.agent?.useCase || 'MULTI_USE'} onChange={(e) => updateAgent('useCase', e.target.value)}>
                  <MenuItem value="OTP">OTP</MenuItem>
                  <MenuItem value="TRANSACTIONAL">Transactional</MenuItem>
                  <MenuItem value="PROMOTIONAL">Promotional</MenuItem>
                  <MenuItem value="MULTI_USE">Multi-use</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Fallback</InputLabel>
                <Select label="Fallback" value={settings.agent?.fallbackMode || 'none'} onChange={(e) => updateAgent('fallbackMode', e.target.value)}>
                  <MenuItem value="none">No automatic fallback</MenuItem>
                  <MenuItem value="whatsapp">WhatsApp when 24-hour window permits</MenuItem>
                  <MenuItem value="sms">SMS adapter</MenuItem>
                </Select>
              </FormControl>
              <Button variant="contained" onClick={saveAgent} disabled={busy === 'save' || !settings.agent?.agentId}>
                {busy === 'save' ? <CircularProgress size={20} color="inherit" /> : 'Save RCS agent'}
              </Button>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mt: 2 }}>
              <TextField fullWidth size="small" label="Webhook URL" value={settings.webhookUrl || ''} InputProps={{ readOnly: true }} />
              <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={copyWebhook}>Copy</Button>
            </Stack>
          </CardContent>
        </Card>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2,minmax(0,1fr))' }, gap: 2.5 }}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={800}>Capability checker</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Check whether a number is reachable by your launched RCS agent and which rich-message features it supports.
              </Typography>
              <Stack spacing={1.5}>
                <TextField label="Phone (E.164)" placeholder="+919876543210" value={capPhone} onChange={(e) => setCapPhone(e.target.value)} />
                <Button variant="outlined" onClick={checkCapability} disabled={!agentReady || !capPhone || busy === 'capability'}>
                  {busy === 'capability' ? <CircularProgress size={20} /> : 'Check RCS capability'}
                </Button>
                {capability ? (
                  <Alert severity={capability.reachable ? 'success' : 'info'}>
                    {capability.reachable
                      ? `RCS reachable. ${capability.features?.length || 0} feature(s) reported.`
                      : 'Not reachable by this RCS agent; configured fallback can be used.'}
                  </Alert>
                ) : null}
                {capability?.features?.length ? (
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    {capability.features.map((feature) => <Chip key={feature} size="small" label={feature} />)}
                  </Stack>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={800}>Send test / direct message</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                RCS is attempted first. If the number is unreachable, the configured fallback rule is applied.
              </Typography>
              <Stack spacing={1.5}>
                <TextField label="Phone (E.164)" placeholder="+919876543210" value={sendPhone} onChange={(e) => setSendPhone(e.target.value)} />
                <FormControl fullWidth>
                  <InputLabel>Traffic type</InputLabel>
                  <Select label="Traffic type" value={trafficType} onChange={(e) => setTrafficType(e.target.value)}>
                    <MenuItem value="TRANSACTION">Transaction</MenuItem>
                    <MenuItem value="PROMOTION">Promotion</MenuItem>
                    <MenuItem value="SERVICEREQUEST">Service request</MenuItem>
                    <MenuItem value="AUTHENTICATION">Authentication</MenuItem>
                    <MenuItem value="ACKNOWLEDGEMENT">Acknowledgement</MenuItem>
                  </Select>
                </FormControl>
                <TextField multiline minRows={4} label="Message" value={sendText} onChange={(e) => setSendText(e.target.value)} inputProps={{ maxLength: 3072 }} />
                <Button startIcon={<SendRoundedIcon />} variant="contained" onClick={sendMessage} disabled={!agentReady || !sendPhone || !sendText.trim() || busy === 'send'}>
                  {busy === 'send' ? <CircularProgress size={20} color="inherit" /> : 'Send message'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <CampaignRoundedIcon />
              <Typography variant="h6" fontWeight={800}>RCS campaign</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Up to 100 opted-in recipients per request. Every number is capability-checked before sending and opt-outs are suppressed automatically.
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
              <TextField
                multiline
                minRows={6}
                label="Recipients"
                helperText="One E.164 number per line, or separate with commas."
                placeholder={'+919876543210\n+919812345678'}
                value={campaignRecipients}
                onChange={(e) => setCampaignRecipients(e.target.value)}
              />
              <Stack spacing={1.5}>
                <FormControl fullWidth>
                  <InputLabel>Traffic type</InputLabel>
                  <Select label="Traffic type" value={campaignTraffic} onChange={(e) => setCampaignTraffic(e.target.value)}>
                    <MenuItem value="PROMOTION">Promotion</MenuItem>
                    <MenuItem value="TRANSACTION">Transaction</MenuItem>
                    <MenuItem value="SERVICEREQUEST">Service request</MenuItem>
                  </Select>
                </FormControl>
                <TextField multiline minRows={3} label="Campaign message" value={campaignText} onChange={(e) => setCampaignText(e.target.value)} inputProps={{ maxLength: 3072 }} />
                <FormControlLabel
                  control={<Checkbox checked={consentConfirmed} onChange={(e) => setConsentConfirmed(e.target.checked)} />}
                  label="I confirm these recipients have opted in to receive this RCS message."
                />
                <Button
                  variant="contained"
                  startIcon={<CampaignRoundedIcon />}
                  onClick={runCampaign}
                  disabled={!agentReady || !campaignText.trim() || !campaignRecipients.trim() || !consentConfirmed || busy === 'campaign'}
                >
                  {busy === 'campaign' ? <CircularProgress size={20} color="inherit" /> : 'Send campaign'}
                </Button>
              </Stack>
            </Box>

            {campaignResult?.summary ? (
              <Alert severity={campaignResult.summary.failed ? 'warning' : 'success'} sx={{ mt: 2 }}>
                Total {campaignResult.summary.total} · Sent {campaignResult.summary.sent} · Failed {campaignResult.summary.failed} ·
                RCS {campaignResult.summary.rcs} · WhatsApp {campaignResult.summary.whatsapp} · SMS {campaignResult.summary.sms}
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={800}>Recent RCS activity</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Incoming messages, delivery/read events, direct sends and fallback sends received through the signed webhook.
            </Typography>
            <Divider />
            {loading ? (
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ py: 4 }}>
                <CircularProgress size={20} /><Typography variant="body2">Loading activity…</Typography>
              </Stack>
            ) : messages.length ? (
              <Stack divider={<Divider flexItem />}>
                {messages.slice(0, 30).map((message) => (
                  <Stack key={message._id} direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" sx={{ py: 1.25 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        <Chip size="small" label={String(message.channel || 'rcs').toUpperCase()} />
                        <Chip size="small" variant="outlined" label={message.direction || message.kind || 'message'} />
                        {message.status ? <Chip size="small" variant="outlined" label={message.status} /> : null}
                      </Stack>
                      <Typography variant="body2" fontWeight={700} sx={{ mt: 0.75 }}>{message.phone || 'RCS event'}</Typography>
                      {message.text ? <Typography variant="body2" color="text.secondary">{message.text}</Typography> : null}
                      {message.eventType ? <Typography variant="caption" color="text.secondary">{message.eventType}</Typography> : null}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {message.createdAt ? new Date(message.createdAt).toLocaleString('en-IN') : ''}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>No RCS activity yet.</Typography>
            )}
          </CardContent>
        </Card>
      </Stack>
    </PageBody>
  );
}
