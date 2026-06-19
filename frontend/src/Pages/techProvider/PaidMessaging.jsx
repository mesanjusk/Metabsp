import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, FormControl, IconButton, InputLabel, MenuItem, Select,
  Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import apiClient from '../../apiClient';

function statusColor(s) {
  if (!s) return 'default';
  if (s === 'APPROVED') return 'success';
  if (s === 'PENDING') return 'warning';
  if (s === 'REJECTED') return 'error';
  return 'default';
}

function categoryColor(c) {
  if (c === 'MARKETING') return 'primary';
  if (c === 'AUTHENTICATION') return 'secondary';
  if (c === 'UTILITY') return 'default';
  return 'default';
}

export default function PaidMessaging() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

  // Send form
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [to, setTo] = useState('');
  const [langCode, setLangCode] = useState('en_US');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sendError, setSendError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/api/tech-provider/templates');
      setTemplates(res.data.templates || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'ALL' ? templates : templates.filter((t) => t.category === filter);
  const approvedTemplates = templates.filter((t) => t.status === 'APPROVED');

  const handleSend = async () => {
    if (!to || !selectedTemplate) return;
    setSending(true);
    setSendResult(null);
    setSendError('');
    try {
      const res = await apiClient.post('/api/tech-provider/send-template', {
        to,
        templateName: selectedTemplate,
        languageCode: langCode,
      });
      setSendResult(res.data);
    } catch (err) {
      setSendError(err?.response?.data?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Paid / Template Messaging
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            Send pre-approved message templates to recipients.
          </Typography>
        </Box>
        <IconButton onClick={load} disabled={loading}>
          <RefreshRoundedIcon />
        </IconButton>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 380px' }, gap: 3 }}>

        {/* Templates list */}
        <Box>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
            {['ALL', 'MARKETING', 'UTILITY', 'AUTHENTICATION'].map((c) => (
              <Chip
                key={c}
                label={c}
                size="small"
                variant={filter === c ? 'filled' : 'outlined'}
                onClick={() => setFilter(c)}
                sx={filter === c ? { bgcolor: '#25d366', color: '#fff' } : {}}
              />
            ))}
          </Stack>

          {loading ? (
            <Box display="flex" justifyContent="center" pt={6}>
              <CircularProgress sx={{ color: '#25d366' }} />
            </Box>
          ) : filtered.length === 0 ? (
            <Box textAlign="center" py={6}>
              <Typography color="text.secondary">No templates found.</Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {filtered.map((t) => (
                <Card key={t.id} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography fontWeight={600} fontSize={14}>
                        {t.name}
                      </Typography>
                      <Stack direction="row" spacing={0.75}>
                        <Chip label={t.status} size="small" color={statusColor(t.status)} />
                        <Chip label={t.category} size="small" color={categoryColor(t.category)} variant="outlined" />
                      </Stack>
                    </Stack>
                    <Typography color="text.secondary" fontSize={12} mb={1}>
                      Language: {t.language} · ID: {t.id}
                    </Typography>
                    {t.components?.map((c, i) => (
                      <Box key={i} sx={{ bgcolor: 'background.default', borderRadius: 1, p: 1, mb: 0.5 }}>
                        <Typography fontSize={11} color="text.disabled">
                          {c.type}
                        </Typography>
                        <Typography fontSize={12}>{c.text || JSON.stringify(c)}</Typography>
                      </Box>
                    ))}
                    {t.status === 'APPROVED' && (
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{ mt: 1, borderColor: '#25d366', color: '#25d366', fontSize: 11 }}
                        onClick={() => { setSelectedTemplate(t.name); setLangCode(t.language || 'en_US'); }}
                      >
                        Use this template
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>

        {/* Send panel */}
        <Box>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', position: 'sticky', top: 80 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography fontWeight={700} mb={2}>
                Send Template
              </Typography>

              <Stack spacing={2}>
                <TextField
                  label="Recipient phone"
                  size="small"
                  fullWidth
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="e.g. 919876543210"
                  helperText="Include country code, no + or spaces"
                />

                <FormControl size="small" fullWidth>
                  <InputLabel>Template</InputLabel>
                  <Select
                    value={selectedTemplate}
                    label="Template"
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                  >
                    {approvedTemplates.map((t) => (
                      <MenuItem key={t.id} value={t.name}>{t.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Language code"
                  size="small"
                  fullWidth
                  value={langCode}
                  onChange={(e) => setLangCode(e.target.value)}
                  placeholder="en_US"
                />

                <Button
                  variant="contained"
                  startIcon={sending ? <CircularProgress size={16} /> : <SendRoundedIcon />}
                  onClick={handleSend}
                  disabled={sending || !to || !selectedTemplate}
                  sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#1da851' } }}
                >
                  Send
                </Button>

                {sendError && <Alert severity="error" onClose={() => setSendError('')}>{sendError}</Alert>}
                {sendResult && (
                  <Alert severity="success" onClose={() => setSendResult(null)}>
                    Message sent! ID: {sendResult.data?.messages?.[0]?.id || 'ok'}
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
