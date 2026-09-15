'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
  IconButton,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import apiClient from '@/lib/api/client';
import { toast } from '@/lib/ui/components/Toast';
import { parseApiError } from '@/lib/api/parseApiError';

const ENDPOINT = '/api/google-business/admin/credentials';

/**
 * Admin-only: the platform's own Google OAuth client.
 *
 * This is one client for the whole deployment, not one per customer — the same
 * shape as the Meta app credentials. Every merchant then authorises it through
 * Google's consent screen from their own Google dashboard and never sees it.
 * The panel exists so rotating it does not need a redeploy.
 *
 * The secret is write-only by design: it is never sent back, here or anywhere,
 * so the field is always blank on load and the last four digits are the only
 * confirmation that the right value is stored.
 */
export default function AdminGoogleCredentialsPanel() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [secretVisible, setSecretVisible] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = (await apiClient.get(ENDPOINT))?.data?.data || null;
      setState(data);
      setClientId(data?.saved?.clientId || data?.clientId || '');
      setRedirectUri(data?.saved?.redirectUri || '');
      setClientSecret('');
    } catch (err) {
      setError(parseApiError(err, 'Could not load the Google client configuration.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await apiClient.put(ENDPOINT, {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        redirectUri: redirectUri.trim(),
      });
      toast.success(response?.data?.message || 'Google client saved.');
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not save the Google client.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await apiClient.delete(ENDPOINT);
      toast.success(response?.data?.message || 'Stored Google client removed.');
      setConfirmRemove(false);
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not remove the stored Google client.'));
    } finally {
      setSaving(false);
    }
  };

  // A different client ID in the box than the one in force: the difference
  // between editing a redirect URI and stranding every connected merchant.
  const changesClient = Boolean(
    state?.clientId && clientId.trim() && clientId.trim() !== state.clientId
  );

  const source = state?.source || 'none';
  const sourceChip =
    source === 'database'
      ? { label: 'Using the client saved here', color: 'success' }
      : source === 'environment'
        ? { label: 'Using the environment variables', color: 'info' }
        : { label: 'Not configured', color: 'warning' };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3 }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}>
              <StorefrontRoundedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={750}>Google Business Profile client</Typography>
              <Typography variant="body2" color="text.secondary">
                One OAuth client for the whole platform. Merchants connect their own profiles against it.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={sourceChip.label} color={sourceChip.color} variant="outlined" />
            <IconButton size="small" onClick={load} disabled={loading || saving} aria-label="Reload">
              <RefreshRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}

        {loading ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Loading configuration…</Typography>
          </Stack>
        ) : (
          <>
            {source === 'none' ? (
              <Alert severity="warning">
                <AlertTitle>No Google client configured</AlertTitle>
                Until one is saved here or set in the environment, the Google tab tells merchants the service is
                unconfigured and the Connect button stays hidden.
              </Alert>
            ) : (
              <Alert severity={source === 'database' ? 'success' : 'info'}>
                Merchants can connect. Client <code>{state?.clientId}</code>, secret ending{' '}
                <code>{state?.clientSecretLastFour}</code>.
                {source === 'environment'
                  ? ' This is coming from the environment variables — saving a client below overrides them.'
                  : ''}
              </Alert>
            )}

            <Stack spacing={2}>
              <TextField
                label="Client ID"
                size="small"
                fullWidth
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                placeholder="1234567890-abc123.apps.googleusercontent.com"
                helperText="From the Web application OAuth client in your Google Cloud project."
              />
              <TextField
                label="Client secret"
                size="small"
                fullWidth
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
                type={secretVisible ? 'text' : 'password'}
                placeholder={state?.clientSecretLastFour ? `•••••••••••••${state.clientSecretLastFour}` : ''}
                helperText={
                  changesClient
                    ? 'Required: you are changing the client ID, and a secret belongs to one client ID.'
                    : state?.saved
                      ? 'Write-only. Leave blank to keep the stored secret — it is never sent back to this screen.'
                      : 'Write-only. Required the first time a client is saved; never sent back afterwards.'
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSecretVisible((v) => !v)} edge="end" aria-label="Toggle secret visibility">
                        {secretVisible ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Redirect URI (optional)"
                size="small"
                fullWidth
                value={redirectUri}
                onChange={(event) => setRedirectUri(event.target.value)}
                placeholder={state?.redirectUri || 'https://…/api/google-business/oauth/callback'}
                helperText={
                  state?.redirectUri
                    ? `Leave blank to keep using ${state.redirectUri}`
                    : 'Leave blank to derive it from the public site URL.'
                }
              />
            </Stack>

            {state?.connections?.total ? (
              <Alert severity={changesClient ? 'warning' : 'info'}>
                {state.connections.total} merchant {state.connections.total === 1 ? 'profile is' : 'profiles are'}{' '}
                connected against the current client.
                {changesClient
                  ? ' Saving a different client ID will invalidate their authorizations — a Google refresh token only works for the client that issued it, so each of them will have to reconnect.'
                  : ''}
                {state.connections.needingReconnect
                  ? ` ${state.connections.needingReconnect} already need to reconnect after an earlier change.`
                  : ''}
              </Alert>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="contained"
                onClick={save}
                disabled={saving || !clientId.trim() || (!clientSecret.trim() && (!state?.saved || changesClient))}
              >
                Save client
              </Button>
              {state?.saved ? (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineRoundedIcon />}
                  onClick={() => setConfirmRemove(true)}
                  disabled={saving}
                >
                  Remove stored client
                </Button>
              ) : null}
            </Stack>

            <Box>
              <Typography variant="caption" color="text.secondary" component="div">
                This redirect URI must be registered on the same OAuth client in Google Cloud, and the project needs
                the Business Profile APIs enabled with access approved — a new project starts at zero quota. Steps are
                in{' '}
                <MuiLink href="https://developers.google.com/my-business/content/prereqs" target="_blank" rel="noopener">
                  Google&apos;s prerequisites
                </MuiLink>
                .
              </Typography>
              {state?.saved?.updatedAt ? (
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>
                  Last changed {new Date(state.saved.updatedAt).toLocaleString()}
                  {state.saved.updatedBy ? ` by ${state.saved.updatedBy}` : ''}.
                </Typography>
              ) : null}
            </Box>
          </>
        )}
      </Stack>

      <Dialog open={confirmRemove} onClose={() => setConfirmRemove(false)}>
        <DialogTitle>Remove the stored Google client?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The platform falls back to the environment variables
            {state?.environment?.hasClientId && state?.environment?.hasClientSecret
              ? ', which are set — merchants keep connecting as before.'
              : ', which are not both set — the Google service will report itself as unconfigured until you save a client again.'}
            <br />
            <br />
            Merchants who already connected keep their authorization only while the client that issued it is still in
            use. Removing a client that merchants authorised against will make their next token refresh fail, and they
            will have to reconnect.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemove(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={remove} disabled={saving}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
