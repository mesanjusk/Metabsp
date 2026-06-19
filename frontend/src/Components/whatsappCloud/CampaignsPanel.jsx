import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SendIcon from '@mui/icons-material/Send';
import whatsappService from '../../services/whatsappService';

const formatWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString();
};

const statusColor = (s) =>
  s === 'SENT'      ? 'success' :
  s === 'SENDING'   ? 'warning' :
  s === 'SCHEDULED' ? 'info'    :
  s === 'CANCELLED' ? 'error'   : 'default';

export default function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState(null);
  const [sending,   setSending]   = useState(null);
  const [deleting,  setDeleting]  = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await whatsappService.listCampaigns();
      setCampaigns(Array.isArray(res.data) ? res.data : []);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSend = async (id) => {
    setSending(id);
    try {
      await whatsappService.sendCampaignNow(id);
      await load();
    } catch (e) {
      console.error('[campaigns] send error:', e.message);
    } finally { setSending(null); }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await whatsappService.deleteCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c._id !== id));
    } finally { setDeleting(null); }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>Campaigns</Typography>
              <Typography variant="body2" color="text.secondary">
                Saved manual and scheduled WhatsApp campaigns with per-recipient tracking.
              </Typography>
            </Box>
            <Button variant="outlined" onClick={load} disabled={loading}>Refresh</Button>
          </Stack>

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          {campaigns.length === 0 && !loading && (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No campaigns yet. Use the Manual tab to create one.
            </Typography>
          )}

          <Stack spacing={1.5}>
            {campaigns.map((c) => (
              <Accordion
                key={c._id}
                expanded={expanded === c._id}
                onChange={(_, open) => setExpanded(open ? c._id : null)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" sx={{ width: '100%' }}>
                    <Typography fontWeight={700} sx={{ flex: 1 }}>{c.title || 'Untitled'}</Typography>
                    <Chip label={c.status} color={statusColor(c.status)} size="small" />
                    <Chip label={c.type || 'manual'} variant="outlined" size="small" />
                    <Typography variant="caption" color="text.secondary">
                      {c.recipients?.length || 0} recipients · {c.sentCount || 0} sent · {c.failedCount || 0} failed
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{formatWhen(c.createdAt)}</Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1.5}>
                    {c.message && (
                      <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{c.message}</Typography>
                      </Box>
                    )}
                    {c.imageUrl && (
                      <Box component="img" src={c.imageUrl} sx={{ maxWidth: 200, borderRadius: 1 }} />
                    )}

                    <Stack direction="row" spacing={1}>
                      {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                        <Button
                          variant="contained"
                          size="small"
                          disabled={sending === c._id}
                          onClick={() => handleSend(c._id)}
                          startIcon={<SendIcon />}
                        >
                          {sending === c._id ? 'Starting…' : 'Send Now'}
                        </Button>
                      )}
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        disabled={deleting === c._id}
                        onClick={() => handleDelete(c._id)}
                      >
                        {deleting === c._id ? 'Deleting…' : 'Delete'}
                      </Button>
                    </Stack>

                    {c.recipients?.length > 0 && (
                      <Box>
                        <Typography fontWeight={700} sx={{ mb: 1 }}>Recipients</Typography>
                        <Stack spacing={0.5}>
                          {c.recipients.map((r, i) => (
                            <Stack key={i} direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                              <Typography variant="body2" sx={{ flex: 1 }}>{r.name} · {r.mobile}</Typography>
                              <Chip
                                label={r.status}
                                color={r.status === 'SENT' ? 'success' : r.status === 'FAILED' ? 'error' : 'default'}
                                size="small"
                              />
                              {r.waUrl && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  component="a"
                                  href={r.waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  wa.me
                                </Button>
                              )}
                              {r.error && <Typography variant="caption" color="error">{r.error}</Typography>}
                            </Stack>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
