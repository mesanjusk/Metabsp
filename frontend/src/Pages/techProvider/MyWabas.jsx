import { useEffect, useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Collapse, Divider,
  IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Tooltip, Typography, Alert,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import apiClient from '../../apiClient';

function qualityColor(q) {
  if (!q) return 'default';
  if (q === 'GREEN') return 'success';
  if (q === 'YELLOW') return 'warning';
  return 'error';
}

function statusColor(s) {
  if (!s) return 'default';
  if (s === 'CONNECTED') return 'success';
  if (s === 'PENDING') return 'warning';
  return 'error';
}

function PhoneRow({ phone }) {
  return (
    <TableRow hover>
      <TableCell sx={{ fontSize: 13 }}>{phone.display_phone_number || phone.id}</TableCell>
      <TableCell sx={{ fontSize: 13 }}>{phone.verified_name || '—'}</TableCell>
      <TableCell>
        <Chip label={phone.status || 'UNKNOWN'} size="small" color={statusColor(phone.status)} />
      </TableCell>
      <TableCell>
        <Chip label={phone.quality_rating || '—'} size="small" color={qualityColor(phone.quality_rating)} />
      </TableCell>
      <TableCell sx={{ fontSize: 13 }}>{phone.platform_type || '—'}</TableCell>
    </TableRow>
  );
}

function WabaCard({ waba, onSubscribe }) {
  const [expanded, setExpanded] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      await onSubscribe(waba.id);
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <BusinessRoundedIcon sx={{ color: '#25d366' }} />
            <Box>
              <Typography fontWeight={700}>{waba.name || waba.id}</Typography>
              <Typography color="text.secondary" fontSize={12}>
                WABA ID: {waba.id} · Currency: {waba.currency || '—'} · Timezone: {waba.timezone_id || '—'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Subscribe to webhooks">
              <Button
                size="small"
                variant="outlined"
                startIcon={subscribing ? <CircularProgress size={14} /> : <NotificationsActiveRoundedIcon />}
                onClick={handleSubscribe}
                disabled={subscribing}
                sx={{ borderColor: '#25d366', color: '#25d366', '&:hover': { bgcolor: 'rgba(37,211,102,0.06)' } }}
              >
                Subscribe
              </Button>
            </Tooltip>
            <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
            </IconButton>
          </Stack>
        </Stack>

        <Collapse in={expanded}>
          <Divider sx={{ my: 2 }} />
          <Typography fontWeight={600} mb={1.5} fontSize={14}>
            Phone Numbers
          </Typography>
          {waba.phone_numbers?.length ? (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Number</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Verified Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Quality</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Platform</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {waba.phone_numbers.map((p) => (
                    <PhoneRow key={p.id} phone={p} />
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : (
            <Typography color="text.secondary" fontSize={13}>
              No phone numbers found for this WABA.
            </Typography>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
}

export default function MyWabas() {
  const [loading, setLoading] = useState(true);
  const [wabas, setWabas] = useState([]);
  const [error, setError] = useState('');
  const [subscribeMsg, setSubscribeMsg] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/api/tech-provider/wabas');
      setWabas(res.data.wabas || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load WABAs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubscribe = async (wabaId) => {
    try {
      await apiClient.post(`/api/tech-provider/wabas/${wabaId}/subscribe`);
      setSubscribeMsg('Successfully subscribed WABA to webhooks.');
    } catch (err) {
      setSubscribeMsg(err?.response?.data?.message || 'Subscription failed');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            My WhatsApp Business Accounts
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            WABAs and phone numbers connected to your Meta app.
          </Typography>
        </Box>
        <IconButton onClick={load} disabled={loading}>
          <RefreshRoundedIcon />
        </IconButton>
      </Stack>

      {subscribeMsg && (
        <Alert severity="info" onClose={() => setSubscribeMsg('')} sx={{ mb: 2 }}>
          {subscribeMsg}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error} — Make sure you have a connected WhatsApp account.
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" pt={6}>
          <CircularProgress sx={{ color: '#25d366' }} />
        </Box>
      ) : wabas.length === 0 ? (
        <Box textAlign="center" py={8}>
          <BusinessRoundedIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">No WABAs found. Connect a WhatsApp Business Account first.</Typography>
        </Box>
      ) : (
        wabas.map((w) => <WabaCard key={w.id} waba={w} onSubscribe={handleSubscribe} />)
      )}
    </Box>
  );
}
