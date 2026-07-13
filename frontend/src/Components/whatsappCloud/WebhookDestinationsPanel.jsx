import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, FormControlLabel, IconButton, Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import apiClient from '../../apiClient';
import { parseApiError } from '../../utils/parseApiError';
import { toast } from '../Toast';

const copySecret = async (value) => {
  try {
    await navigator.clipboard.writeText(value || '');
    toast.success('Secret copied.');
  } catch (_err) {
    toast.error('Could not copy secret.');
  }
};

const ENDPOINT = '/api/whatsapp/webhook-destinations';

function statusChip(dest) {
  if (!dest.lastAttemptAt) return <Chip size="small" label="Not delivered yet" />;
  if (dest.lastStatus === 'success') return <Chip size="small" color="success" label="Delivering OK" />;
  return <Chip size="small" color="error" label="Failed" />;
}

// The Chip above truncates on narrow screens, so show the full error as
// wrapping text underneath instead of relying on a screenshot of the chip.
function statusErrorDetail(dest) {
  if (dest.lastStatus !== 'failed' || !dest.lastError) return null;
  return (
    <Typography variant="caption" color="error" sx={{ display: 'block', wordBreak: 'break-word', mt: 0.25 }}>
      {dest.lastError}
    </Typography>
  );
}

// Every destination visibly declares which entry keyword it owns on the
// shared number; a keyword-less destination still receives unmatched
// messages (legacy fan-out) and should be migrated.
function keywordChip(dest) {
  if (!dest.entryKeyword) {
    return <Chip size="small" color="warning" variant="outlined" label="No keyword — receives all unmatched (legacy fan-out)" />;
  }
  const aliasSuffix = dest.aliases?.length ? ` (+ ${dest.aliases.join(', ')})` : '';
  return <Chip size="small" color="primary" variant="outlined" label={`Keyword: ${dest.entryKeyword}${aliasSuffix}`} />;
}

export default function WebhookDestinationsPanel() {
  const [destinations, setDestinations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [revealedIds, setRevealedIds] = useState(() => new Set());
  const [editingKeywordId, setEditingKeywordId] = useState(null);
  const [editingKeywordValue, setEditingKeywordValue] = useState('');

  const toggleReveal = (id) => setRevealedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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
      await apiClient.post(ENDPOINT, {
        label: newLabel.trim() || 'My project',
        url: newUrl.trim(),
        entryKeyword: newKeyword.trim().toUpperCase(),
      });
      setNewLabel('');
      setNewUrl('');
      setNewKeyword('');
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

  const toggleFanoutFallback = async (dest) => {
    try {
      await apiClient.put(`${ENDPOINT}/${dest.id}`, { fanoutFallback: !dest.fanoutFallback });
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not update fan-out fallback.'));
    }
  };

  const startKeywordEdit = (dest) => {
    setEditingKeywordId(dest.id);
    setEditingKeywordValue(dest.entryKeyword || '');
  };

  const saveKeyword = async (dest) => {
    setError('');
    try {
      await apiClient.put(`${ENDPOINT}/${dest.id}`, { entryKeyword: editingKeywordValue.trim().toUpperCase() });
      setEditingKeywordId(null);
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not update entry keyword.'));
    }
  };

  const regenerateSecret = async (dest) => {
    try {
      await apiClient.post(`${ENDPOINT}/${dest.id}/regenerate-secret`);
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
          There is one WhatsApp webhook URL for your whole account. Add each of your own
          project URLs here with a unique <strong>entry keyword</strong> — an incoming message
          is forwarded only to the destination whose keyword starts the message, or to the
          destination the sender is already in a conversation with (30-minute inactivity
          expiry, released on EXIT). Generic words (HI, HELLO, START, MENU, HELP, STOP, YES,
          NO, OK) are banned as keywords; SETUP is reserved for Metabsp&apos;s own bot. A
          destination without a keyword still receives all unmatched messages (legacy
          fan-out) until you assign one. Each destination gets its own secret to verify the{' '}
          <code>X-Metabsp-Signature-256</code> header.
        </Typography>
      </Stack>

      {error ? <Alert severity="warning" sx={{ mb: 1.5 }}>{error}</Alert> : null}

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
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap">
                    {editingKeywordId === dest.id ? (
                      <>
                        <TextField
                          size="small"
                          label="Entry keyword"
                          placeholder="e.g. PRINT"
                          value={editingKeywordValue}
                          onChange={(e) => setEditingKeywordValue(e.target.value.toUpperCase())}
                          sx={{ maxWidth: 180 }}
                        />
                        <IconButton size="small" color="primary" title="Save keyword" onClick={() => saveKeyword(dest)}>
                          <CheckRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Cancel" onClick={() => setEditingKeywordId(null)}>
                          <CloseRoundedIcon fontSize="small" />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        {keywordChip(dest)}
                        <Tooltip title="Change entry keyword">
                          <IconButton size="small" onClick={() => startKeywordEdit(dest)}>
                            <EditRoundedIcon fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {statusChip(dest)}
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      secret: {revealedIds.has(dest.id) ? dest.secret : dest.secretPreview}
                    </Typography>
                    <Tooltip title={revealedIds.has(dest.id) ? 'Hide' : 'Reveal full secret to paste into the receiving service'}>
                      <IconButton size="small" onClick={() => toggleReveal(dest.id)}>
                        {revealedIds.has(dest.id) ? <VisibilityOffRoundedIcon fontSize="inherit" /> : <VisibilityRoundedIcon fontSize="inherit" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy full secret">
                      <IconButton size="small" onClick={() => copySecret(dest.secret)}>
                        <ContentCopyRoundedIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  {dest.entryKeyword ? (
                    <FormControlLabel
                      sx={{ mt: 0.25 }}
                      control={<Switch size="small" checked={Boolean(dest.fanoutFallback)} onChange={() => toggleFanoutFallback(dest)} />}
                      label={<Typography variant="caption" color="text.secondary">Also receive unmatched messages (fan-out fallback)</Typography>}
                    />
                  ) : null}
                  {statusErrorDetail(dest)}
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
          label="Entry keyword"
          placeholder="e.g. PRINT"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value.toUpperCase())}
          sx={{ minWidth: 140 }}
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
