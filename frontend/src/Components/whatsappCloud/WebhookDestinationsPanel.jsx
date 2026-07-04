import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, Stack, Switch, TextField, Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import apiClient from '../../apiClient';
import { parseApiError } from '../../utils/parseApiError';

const ENDPOINT = '/api/whatsapp/webhook-destinations';

function statusChip(dest) {
  if (!dest.lastAttemptAt) return <Chip size="small" label="Not delivered yet" />;
  if (dest.lastStatus === 'success') return <Chip size="small" color="success" label="Delivering OK" />;
  return <Chip size="small" color="error" label={`Failed: ${dest.lastError || 'unknown error'}`} />;
}

export default function WebhookDestinationsPanel() {
  const [destinations, setDestinations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState(null);

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await apiClient.get(ENDPOINT);
      setDestinations(res?.data?.data || []);
    } catch (err) {
      setError(parseApiError(err, 'Could not load webhook destinations.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addDestination = async () => {
    if (!newUrl.trim()) return;
    setIsAdding(true);
    setError('');
    try {
      const res = await apiClient.post(ENDPOINT, { label: newLabel.trim() || 'My project', url: newUrl.trim() });
      setRevealedSecret(res?.data?.data?.secret || null);
      setNewLabel('');
      setNewUrl('');
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not add webhook destination.'));
    } finally {
      setIsAdding(false);
    }
  };

  const toggleActive = async (dest) => {
    try {
      await apiClient.put(`${ENDPOINT}/${dest.id}`, { isActive: !dest.isActive });
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not update webhook destination.'));
    }
  };

  const regenerateSecret = async (dest) => {
    try {
      const res = await apiClient.post(`${ENDPOINT}/${dest.id}/regenerate-secret`);
      setRevealedSecret(res?.data?.data?.secret || null);
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not regenerate secret.'));
    }
  };

  const removeDestination = async (dest) => {
    try {
      await apiClient.delete(`${ENDPOINT}/${dest.id}`);
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not remove webhook destination.'));
    }
  };

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>Webhook destinations</Typography>
        <Typography variant="body2" color="text.secondary">
          There is one WhatsApp webhook URL for your whole account. Add as many of your own
          project URLs here as you like (School, Clinic, Print Ordering, etc.) — every
          incoming message on this number is forwarded to all of them. Each destination gets
          its own secret to verify the <code>X-Metabsp-Signature-256</code> header.
        </Typography>
      </Stack>

      {error ? <Alert severity="warning" sx={{ mb: 1.5 }}>{error}</Alert> : null}

      {revealedSecret ? (
        <Alert
          severity="info"
          sx={{ mb: 1.5, wordBreak: 'break-all' }}
          onClose={() => setRevealedSecret(null)}
          action={
            <IconButton size="small" color="inherit" title="Copy secret" onClick={() => navigator.clipboard?.writeText(revealedSecret)}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          }
        >
          Copy this secret now — it won't be shown again. Use it on the receiving
          app to verify the <code>X-Metabsp-Signature-256</code> header:
          <br />
          <strong>{revealedSecret}</strong>
        </Alert>
      ) : null}

      <Stack spacing={1.5}>
        {isLoading ? (
          <Typography variant="body2" color="text.secondary">Loading…</Typography>
        ) : destinations.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No webhook destinations yet.</Typography>
        ) : (
          destinations.map((dest) => (
            <Box key={dest.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>{dest.label}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{dest.url}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    {statusChip(dest)}
                    <Typography variant="caption" color="text.secondary">secret: {dest.secretPreview}</Typography>
                  </Stack>
                </Box>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Switch size="small" checked={dest.isActive} onChange={() => toggleActive(dest)} />
                  <IconButton size="small" title="Regenerate secret" onClick={() => regenerateSecret(dest)}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" title="Remove" onClick={() => removeDestination(dest)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Box>
          ))
        )}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
        <TextField
          size="small"
          label="Label"
          placeholder="e.g. School app"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          sx={{ minWidth: 160 }}
        />
        <TextField
          size="small"
          label="Webhook URL"
          placeholder="https://your-other-app.com/webhook"
          type="url"
          fullWidth
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={addDestination} disabled={isAdding || !newUrl.trim()}>
          Add
        </Button>
      </Stack>
    </Box>
  );
}
