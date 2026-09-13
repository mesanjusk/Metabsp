'use client';

import { useCallback, useEffect, useState } from 'react';
import NextLink from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

/**
 * The Google accounts the studio generates through.
 *
 * This is the target of the one action the progress screen offers when a clip cannot be made
 * automatically ("Connect an account"), which pointed at `/accounts` — the path in the repository
 * the studio was ported from, and a 404 here.
 *
 * Two different credentials live on one account and it is worth being clear which is which:
 * the API key is what the generation calls use, and the Flow session is a browser session exported
 * from a real sign-in, used only by the browser-automation path. An account is useful with just the
 * key; the session is what removes the manual hand-off for video clips.
 */

const STATUS_TONE = {
  active: 'success',
  disabled: 'default',
  quota_exceeded: 'warning',
  error: 'error',
};

export default function VideoAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', displayName: '', apiKey: '' });
  const [sessionFor, setSessionFor] = useState(null);
  const [sessionState, setSessionState] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/video/accounts');
      setAccounts(response?.data?.accounts || []);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load your connected accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addAccount = async () => {
    setBusy(true);
    try {
      await apiClient.post('/api/video/accounts', addForm);
      setAddOpen(false);
      setAddForm({ email: '', displayName: '', apiKey: '' });
      setNotice('Account connected.');
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not connect that account.');
    } finally {
      setBusy(false);
    }
  };

  const saveSession = async () => {
    setBusy(true);
    try {
      await apiClient.post(`/api/video/accounts/${sessionFor._id}/flow-session`, { storageState: sessionState });
      setSessionFor(null);
      setSessionState('');
      setNotice('Flow session saved. Clips can be made without a hand-off now.');
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'That session could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const disconnectSession = async (account) => {
    setBusy(true);
    try {
      await apiClient.delete(`/api/video/accounts/${account._id}/flow-session`);
      setNotice('Flow session removed.');
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not remove that session.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageBody
      title="Generation accounts"
      description="The Video Studio generates through your own Google accounts, so the cost and the quota stay yours."
      maxWidth={880}
      actions={
        <Stack direction="row" spacing={1}>
          <Button component={NextLink} href="/services/video" startIcon={<ArrowBackRoundedIcon />} size="small">
            All videos
          </Button>
          <Button variant="contained" size="small" startIcon={<AddRoundedIcon />} onClick={() => setAddOpen(true)}>
            Connect
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2}>
        {error ? (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        ) : null}
        {notice ? (
          <Alert severity="success" onClose={() => setNotice('')}>
            {notice}
          </Alert>
        ) : null}

        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={26} />
          </Stack>
        ) : null}

        {!loading && !accounts.length ? (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                No accounts connected
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Connect one Google account with a Gemini API key and the studio can write scripts, draw your cast and
                generate scene stills. Add a Flow session to the same account and it can make the clips too.
              </Typography>
            </CardContent>
          </Card>
        ) : null}

        {accounts.map((account) => (
          <Card key={account._id} variant="outlined">
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                    {account.displayName || account.email}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {account.email}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  {account.isDefault ? <Chip size="small" label="Default" variant="outlined" /> : null}
                  <Chip
                    size="small"
                    label={String(account.status || 'active').replace(/_/g, ' ')}
                    color={STATUS_TONE[account.status] || 'default'}
                    variant="outlined"
                  />
                  {account.flowSessionConnectedAt ? (
                    <Button size="small" onClick={() => disconnectSession(account)} disabled={busy}>
                      Remove Flow session
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setSessionFor(account);
                        setSessionState('');
                      }}
                    >
                      Add Flow session
                    </Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Connect a Google account</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Google account email"
              value={addForm.email}
              onChange={(event) => setAddForm((prev) => ({ ...prev, email: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Name it"
              value={addForm.displayName}
              onChange={(event) => setAddForm((prev) => ({ ...prev, displayName: event.target.value }))}
              helperText="How it appears in this list, e.g. “Studio main”."
              fullWidth
            />
            <TextField
              label="Gemini API key"
              value={addForm.apiKey}
              onChange={(event) => setAddForm((prev) => ({ ...prev, apiKey: event.target.value }))}
              type="password"
              helperText="Stored encrypted. It is never sent back to this page after saving."
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={addAccount} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(sessionFor)} onClose={() => setSessionFor(null)} fullWidth maxWidth="sm">
        <DialogTitle>Add a Flow session</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sign in to labs.google/flow once in a browser you control, export the session with
            Playwright&apos;s <code>context.storageState()</code>, and paste the JSON here. It is stored encrypted and
            is what lets clips finish without a manual hand-off.
          </Typography>
          <TextField
            label="storageState JSON"
            value={sessionState}
            onChange={(event) => setSessionState(event.target.value)}
            multiline
            minRows={6}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionFor(null)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveSession} disabled={busy || !sessionState.trim()}>
            {busy ? 'Saving…' : 'Save session'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageBody>
  );
}
