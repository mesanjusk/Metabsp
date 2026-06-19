import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, Divider, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import SendIcon from '@mui/icons-material/Send';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import apiClient from '../../apiClient';

const POLL_INTERVAL = 2500;
const QR_TTL = 20;

const statusColor = (s) =>
  s === 'CONNECTED' ? 'success' : s === 'QR_PENDING' ? 'warning' : 'default';

export default function BaileysPanel() {
  const [status,      setStatus]      = useState({ status: 'DISCONNECTED', qr: null, phone: null });
  const [connecting,  setConnecting]  = useState(false);
  const [qrSeconds,   setQrSeconds]   = useState(QR_TTL);
  const [sendTo,      setSendTo]      = useState('');
  const [sendBody,    setSendBody]    = useState('');
  const [sending,     setSending]     = useState(false);
  const [sendResult,  setSendResult]  = useState('');
  const [apiKeys,     setApiKeys]     = useState([]);
  const [newKeyName,  setNewKeyName]  = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [copiedId,    setCopiedId]    = useState(null);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const poll = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/whatsapp/baileys/status');
      setStatus(res.data || { status: 'DISCONNECTED' });
      if (res.data?.status !== 'QR_PENDING') setQrSeconds(QR_TTL);
    } catch (_) {}
  }, []);

  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/whatsapp/api-keys');
      setApiKeys(res.data?.keys || []);
    } catch (_) {}
  }, []);

  const handleCreateKey = async () => {
    setCreatingKey(true);
    try {
      await apiClient.post('/api/whatsapp/api-keys', { name: newKeyName || 'Default' });
      setNewKeyName('');
      await fetchApiKeys();
    } catch (_) {}
    finally { setCreatingKey(false); }
  };

  const handleRevokeKey = async (id) => {
    if (!window.confirm('Revoke this API key? It will stop working immediately.')) return;
    try {
      await apiClient.delete(`/api/whatsapp/api-keys/${id}`);
      await fetchApiKeys();
    } catch (_) {}
  };

  const handleCopy = (key, id) => {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [poll]);

  useEffect(() => { fetchApiKeys(); }, [fetchApiKeys]);

  useEffect(() => {
    if (status.status === 'QR_PENDING') {
      timerRef.current = setInterval(() => {
        setQrSeconds(s => (s > 0 ? s - 1 : 0));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setQrSeconds(QR_TTL);
    }
    return () => clearInterval(timerRef.current);
  }, [status.status]);

  const handleConnect = async () => {
    setConnecting(true);
    try { await apiClient.post('/api/whatsapp/baileys/connect'); }
    catch (_) {}
    finally { setConnecting(false); await poll(); }
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    try { await apiClient.post('/api/whatsapp/baileys/disconnect'); }
    catch (_) {}
    finally { setConnecting(false); await poll(); }
  };

  const handleSend = async () => {
    if (!sendTo || !sendBody) return;
    setSending(true);
    setSendResult('');
    try {
      await apiClient.post('/api/whatsapp/baileys/send-text', { to: sendTo, body: sendBody });
      setSendResult('Sent!');
      setSendBody('');
    } catch (e) {
      setSendResult('Error: ' + (e.response?.data?.message || e.message));
    } finally { setSending(false); }
  };

  const s = status.status;
  const isConnected = s === 'CONNECTED';
  const isQrPending = s === 'QR_PENDING';

  return (
    <Box sx={{ p: 2 }}>
      {/* Status Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" spacing={1}>
            <Box>
              <Typography variant="h6" fontWeight={800}>Baileys (WhatsApp QR)</Typography>
              <Typography variant="body2" color="text.secondary">
                Connect via QR code to send messages without Meta Cloud API.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={isConnected ? <WifiIcon /> : <WifiOffIcon />}
                label={s}
                color={statusColor(s)}
                size="small"
              />
              {status.phone && (
                <Chip label={`+${status.phone}`} color="success" size="small" variant="outlined" />
              )}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            {!isConnected && (
              <Button
                variant="contained"
                startIcon={connecting ? <CircularProgress size={14} color="inherit" /> : <QrCode2RoundedIcon />}
                onClick={handleConnect}
                disabled={connecting}
              >
                {isQrPending ? 'Get New QR' : 'Connect'}
              </Button>
            )}
            {(isConnected || isQrPending) && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleDisconnect}
                disabled={connecting}
              >
                Disconnect & Reset
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* QR code */}
      {isQrPending && status.qr && (
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Alert severity={qrSeconds === 0 ? 'error' : 'info'} sx={{ mb: 2 }}>
              {qrSeconds === 0
                ? 'QR expired — next QR loading automatically…'
                : `Open WhatsApp → tap ⋮ → Linked Devices → Link a Device → scan below (refreshes in ${qrSeconds}s)`}
            </Alert>
            <Box
              component="img"
              src={status.qr}
              alt="QR Code"
              sx={{
                width: 260, height: 260,
                border: '4px solid',
                borderColor: qrSeconds === 0 ? 'error.main' : 'warning.main',
                borderRadius: 2,
                opacity: qrSeconds === 0 ? 0.4 : 1,
                transition: 'opacity 0.3s',
              }}
            />
          </CardContent>
        </Card>
      )}

      {isConnected && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Connected{status.phone ? ` as +${status.phone}` : ''}. Ready to send messages.
        </Alert>
      )}

      {/* Quick Send */}
      {isConnected && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Quick Send</Typography>
            <Stack spacing={1.5}>
              <TextField
                label="To (phone number with country code)"
                size="small"
                value={sendTo}
                onChange={e => setSendTo(e.target.value)}
                placeholder="919876543210"
              />
              <TextField
                label="Message"
                size="small"
                multiline
                minRows={2}
                value={sendBody}
                onChange={e => setSendBody(e.target.value)}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  startIcon={sending ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
                  onClick={handleSend}
                  disabled={sending || !sendTo || !sendBody}
                >
                  {sending ? 'Sending…' : 'Send'}
                </Button>
                {sendResult && (
                  <Typography variant="body2" color={sendResult.startsWith('Error') ? 'error' : 'success.main'}>
                    {sendResult}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* API Key Management */}
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <VpnKeyIcon color="action" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>External API Keys</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Use these keys to send WhatsApp messages via Baileys from external apps.
            Endpoint: <code>POST https://bulk-invite.onrender.com/api/v1/baileys/send</code>
            with header <code>X-Api-Key: &lt;key&gt;</code>
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <TextField
              size="small"
              label="Key name (optional)"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              sx={{ width: 220 }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleCreateKey}
              disabled={creatingKey}
              startIcon={creatingKey ? <CircularProgress size={12} color="inherit" /> : <VpnKeyIcon />}
            >
              {creatingKey ? 'Creating…' : 'Create Key'}
            </Button>
          </Stack>

          {apiKeys.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No API keys yet.</Typography>
          ) : (
            <Stack spacing={1}>
              {apiKeys.map(k => (
                <Box key={k.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" fontWeight={700}>{k.name}</Typography>
                        {!k.isActive && <Chip label="Revoked" size="small" color="error" />}
                      </Stack>
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: 'monospace', wordBreak: 'break-all', color: k.isActive ? 'text.primary' : 'text.disabled' }}
                      >
                        {k.key}
                      </Typography>
                      {k.lastUsedAt && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Last used: {new Date(k.lastUsedAt).toLocaleString()}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title={copiedId === k.id ? 'Copied!' : 'Copy key'}>
                        <IconButton size="small" onClick={() => handleCopy(k.key, k.id)}>
                          <ContentCopyIcon fontSize="small" color={copiedId === k.id ? 'success' : 'action'} />
                        </IconButton>
                      </Tooltip>
                      {k.isActive && (
                        <Tooltip title="Revoke key">
                          <IconButton size="small" onClick={() => handleRevokeKey(k.id)} color="error">
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}

          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary" component="div">
            <strong>API Usage:</strong><br />
            <code>POST /api/v1/baileys/send</code> — Send text or image<br />
            <code>POST /api/v1/baileys/send-text</code> — Text only<br />
            <code>POST /api/v1/baileys/send-image</code> — Image with caption<br />
            <code>POST /api/v1/baileys/send-bulk</code> — Bulk send (max 500)<br />
            <code>GET /api/v1/baileys/status</code> — Check connection status
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
