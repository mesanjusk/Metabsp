import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, IconButton,
  Paper, Stack, Tooltip, Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import WebhookRoundedIcon from '@mui/icons-material/WebhookRounded';
import apiClient from '../../apiClient';

function timeAgo(date) {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function eventType(event) {
  try {
    const changes = event.entry?.[0]?.changes?.[0];
    const field = changes?.field;
    const msgType = changes?.value?.messages?.[0]?.type;
    if (field === 'messages' && msgType) return `message:${msgType}`;
    if (field) return field;
    return event.object || 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

function chipColor(type) {
  if (type.startsWith('message:')) return 'success';
  if (type === 'statuses') return 'warning';
  if (type === 'account_alerts') return 'error';
  return 'default';
}

export default function WebhookViewer() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);
  const intervalRef = useRef(null);

  const load = async () => {
    try {
      const res = await apiClient.get('/api/tech-provider/webhook-events?limit=100');
      setEvents(res.data.events || []);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleClear = async () => {
    setClearing(true);
    try {
      await apiClient.delete('/api/tech-provider/webhook-events');
      setEvents([]);
      setSelected(null);
    } catch (_) {}
    setClearing(false);
  };

  const handleCopy = (json) => {
    navigator.clipboard.writeText(json);
  };

  const selectedEvent = selected !== null ? events[selected] : null;
  const selectedJson = selectedEvent ? JSON.stringify(
    { object: selectedEvent.object, entry: selectedEvent.entry },
    null, 2
  ) : '';

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Webhook Viewer
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            Live incoming webhook payloads from Meta. Auto-refreshes every 5s.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Clear all events">
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={clearing ? <CircularProgress size={14} /> : <DeleteRoundedIcon />}
              onClick={handleClear}
              disabled={clearing || events.length === 0}
            >
              Clear
            </Button>
          </Tooltip>
          <IconButton onClick={load}>
            <RefreshRoundedIcon />
          </IconButton>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '340px 1fr' }, gap: 2, height: 'calc(100vh - 240px)', minHeight: 400 }}>
        {/* Event list */}
        <Paper
          sx={{
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography fontWeight={600} fontSize={13}>
              Events ({events.length})
            </Typography>
            {loading && <CircularProgress size={14} />}
          </Box>
          <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
            {events.length === 0 ? (
              <Box textAlign="center" py={6}>
                <WebhookRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary" fontSize={13}>
                  No webhook events yet.
                </Typography>
                <Typography color="text.disabled" fontSize={12} mt={0.5}>
                  Events will appear here as they arrive.
                </Typography>
              </Box>
            ) : (
              events.map((ev, i) => {
                const type = eventType(ev);
                return (
                  <Box
                    key={ev._id || i}
                    onClick={() => setSelected(i)}
                    sx={{
                      px: 2,
                      py: 1.5,
                      cursor: 'pointer',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      bgcolor: selected === i ? 'rgba(37,211,102,0.08)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(37,211,102,0.05)' },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Chip label={type} size="small" color={chipColor(type)} sx={{ fontSize: 11, height: 20 }} />
                      <Typography fontSize={11} color="text.disabled">
                        {ev.receivedAt ? timeAgo(ev.receivedAt) : ''}
                      </Typography>
                    </Stack>
                    <Typography fontSize={12} color="text.secondary" mt={0.5} noWrap>
                      {ev.object} · {ev.entry?.[0]?.id || '—'}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Paper>

        {/* Detail panel */}
        <Paper
          sx={{
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {selectedEvent ? (
            <>
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography fontWeight={600} fontSize={13}>
                  Payload
                </Typography>
                <Tooltip title="Copy JSON">
                  <IconButton size="small" onClick={() => handleCopy(selectedJson)}>
                    <ContentCopyRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                component="pre"
                sx={{
                  flexGrow: 1,
                  overflowY: 'auto',
                  p: 2,
                  m: 0,
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  color: 'text.primary',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {selectedJson}
              </Box>
              <Divider />
              <Box sx={{ px: 2, py: 1, bgcolor: 'background.default' }}>
                <Typography fontSize={11} color="text.disabled">
                  Received: {selectedEvent.receivedAt ? new Date(selectedEvent.receivedAt).toLocaleString() : '—'} ·
                  Sig: {selectedEvent.headers?.['x-hub-signature-256']?.slice(0, 18) || 'n/a'}…
                </Typography>
              </Box>
            </>
          ) : (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%">
              <WebhookRoundedIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary">Select an event to inspect its payload</Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
