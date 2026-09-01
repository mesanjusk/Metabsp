'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import apiClient from '@/lib/api/client';
import { parseApiError } from '@/lib/api/parseApiError';
import { toast } from '@/lib/ui/components/Toast';
import { EmptyState } from '@/lib/ui/components/ui';

/**
 * API key management.
 *
 * The endpoints for this existed and the marketing site advertised "a REST API
 * secured by your own API keys", but there was no screen anywhere in the
 * product that could issue one — the feature was reachable only by calling the
 * API that the key was needed for. This is that screen.
 *
 * Keys are hashed server-side, so the secret is displayed exactly once, in the
 * dialog below, and every later view shows only a prefix.
 */
const formatDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—');

export default function ApiKeysPanel() {
  const [keys, setKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [issuedKey, setIssuedKey] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/whatsapp/api-keys');
      setKeys(Array.isArray(response?.data?.keys) ? response.data.keys : []);
    } catch (err) {
      setError(parseApiError(err, 'Could not load API keys.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setIsSaving(true);
    try {
      const response = await apiClient.post('/api/whatsapp/api-keys', { name: newName.trim() || 'Default' });
      setIssuedKey(response?.data?.key || '');
      setCreateOpen(false);
      setNewName('');
      await load();
    } catch (err) {
      toast.error(parseApiError(err, 'Could not create the API key.'));
    } finally {
      setIsSaving(false);
    }
  };

  const revoke = async (id, name) => {
    // Revoking breaks any integration still using the key, and there is no
    // undo — a confirmation is warranted where it usually would not be.
    if (!window.confirm(`Revoke "${name}"? Any integration using this key stops working immediately.`)) return;
    try {
      await apiClient.delete(`/api/whatsapp/api-keys/${id}`);
      toast.success('API key revoked.');
      await load();
    } catch (err) {
      toast.error(parseApiError(err, 'Could not revoke the key.'));
    }
  };

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied to clipboard.');
    } catch {
      toast.error('Could not copy — select the key and copy it manually.');
    }
  };

  const activeKeys = keys.filter((key) => key.isActive);

  return (
    <Card>
      <CardHeader
        title="API keys"
        subheader="Authenticate server-to-server calls to /api/v1. Each key acts as the number you have connected."
        titleTypographyProps={{ variant: 'h6' }}
        subheaderTypographyProps={{ variant: 'body2' }}
        action={
          <Button startIcon={<AddRoundedIcon />} variant="contained" size="small" onClick={() => setCreateOpen(true)}>
            New key
          </Button>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {error ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        {!isLoading && !keys.length ? (
          <EmptyState
            title="No API keys yet"
            description="Create one to send messages from your own backend without a browser session."
          />
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Key</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Last used</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id} sx={{ opacity: key.isActive ? 1 : 0.55 }}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={600}>
                          {key.name}
                        </Typography>
                        {!key.isActive ? <Chip size="small" label="Revoked" /> : null}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {key.maskedKey}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatDate(key.createdAt)}</TableCell>
                    <TableCell>{key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}</TableCell>
                    <TableCell align="right">
                      {key.isActive ? (
                        <Tooltip title="Revoke">
                          <IconButton size="small" color="error" onClick={() => revoke(key.id, key.name)}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {activeKeys.length ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Send a key as <code>Authorization: Bearer &lt;key&gt;</code>. Never put it in a URL or in
            browser-side code — anything shipped to a browser is public.
          </Typography>
        ) : null}
      </CardContent>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create an API key</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Name"
            placeholder="Order notifications"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            helperText="Name it after the system that will use it, so you know what breaks if you revoke it."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={create} disabled={isSaving}>
            {isSaving ? 'Creating…' : 'Create key'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(issuedKey)} onClose={() => setIssuedKey(null)} fullWidth maxWidth="sm">
        <DialogTitle>Copy your API key now</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>This is the only time it will be shown</AlertTitle>
            We store a hash of the key, not the key itself, so we cannot show it again. Losing it means
            creating a new one.
          </Alert>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              value={issuedKey || ''}
              InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.8125rem' } }}
            />
            <Tooltip title="Copy">
              <IconButton onClick={() => copy(issuedKey)}>
                <ContentCopyRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setIssuedKey(null)}>
            I have saved it
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
