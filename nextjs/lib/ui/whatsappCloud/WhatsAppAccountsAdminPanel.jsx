'use client';

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import apiClient from '@/lib/api/client';
import { toast } from '@/lib/ui/components/Toast';
import { parseApiError } from '@/lib/api/parseApiError';

const formatWhen = (value) => (value ? new Date(value).toLocaleString() : 'never');

/**
 * Every WhatsApp account on the deployment, listed by account rather than by
 * user.
 *
 * The other screens show accounts through whichever user you happen to be
 * looking at, and that is the wrong shape for the problem they cause: an
 * inbound webhook resolves a number by phone_number_id across ALL accounts,
 * so when two rows claim one number, no per-user view can show you that. A
 * deployment lost hours to a stale row whose wabaId held a Meta App ID —
 * visible in its effects, unreachable from any screen.
 */
export default function WhatsAppAccountsAdminPanel() {
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [repairing, setRepairing] = useState(null);
  const [repairWabaId, setRepairWabaId] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/whatsapp/admin/accounts');
      setAccounts(response?.data?.data || []);
      setSummary(response?.data?.summary || null);
    } catch (err) {
      setError(parseApiError(err, 'Could not load WhatsApp accounts.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      await apiClient.delete(`/api/whatsapp/admin/accounts/${pendingDelete.id}`);
      toast.success('Account removed.');
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not delete this account.'));
    } finally {
      setBusyId('');
    }
  };

  const handleRepair = async () => {
    if (!repairing || !repairWabaId.trim()) return;
    setBusyId(repairing.id);
    try {
      const response = await apiClient.patch(
        `/api/whatsapp/admin/accounts/${repairing.id}`,
        { wabaId: repairWabaId.trim(), businessAccountId: repairWabaId.trim() },
        { headers: { 'Content-Type': 'application/json' } }
      );
      toast.success(response?.data?.message || 'WABA id updated.');
      setRepairing(null);
      setRepairWabaId('');
      await load();
    } catch (err) {
      setError(parseApiError(err, 'Could not update the WABA id.'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={700}>All connected WhatsApp accounts</Typography>
            <Typography variant="body2" color="text.secondary">
              Every account on this deployment, whoever owns it. Inbound messages are routed by phone number ID
              across all of them — so a second row claiming one number is what answers instead of the right one.
            </Typography>
          </Box>
          <Button startIcon={<RefreshRoundedIcon />} onClick={load} disabled={isLoading}>Refresh</Button>
        </Stack>

        {error ? <Alert severity="warning">{error}</Alert> : null}

        {summary?.duplicateNumbers?.length ? (
          <Alert severity="error">
            More than one account claims {summary.duplicateNumbers.length === 1 ? 'this number' : 'these numbers'}:{' '}
            <strong>{summary.duplicateNumbers.join(', ')}</strong>. Only one should exist — remove the wrong one.
          </Alert>
        ) : null}

        {summary?.orphaned ? (
          <Alert severity="warning">
            {summary.orphaned} account(s) have no owning user left. No other screen can reach these; delete them here.
          </Alert>
        ) : null}

        {isLoading ? <CircularProgress size={24} /> : null}

        {!isLoading && !accounts.length ? (
          <Alert severity="info">No WhatsApp accounts are connected on this deployment.</Alert>
        ) : null}

        {accounts.length ? (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Phone number ID</TableCell>
                  <TableCell>WABA ID</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Last webhook</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id} hover>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" fontWeight={700}>{account.phoneNumberId || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {account.displayPhoneNumber || account.verifiedName || ''}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{account.wabaId || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      {account.owner ? (
                        <Stack spacing={0.25}>
                          <Typography variant="body2">{account.owner.mobile || account.owner.id}</Typography>
                          <Typography variant="caption" color="text.secondary">{account.owner.displayName}</Typography>
                        </Stack>
                      ) : (
                        <Chip size="small" color="warning" label="No owner" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                        <Chip size="small" label={account.isActive ? 'Active' : 'Inactive'} color={account.isActive ? 'success' : 'default'} />
                        {account.webhookSubscribed ? <Chip size="small" label="Subscribed" color="info" /> : null}
                        {account.duplicateNumber ? <Chip size="small" label="Duplicate" color="error" /> : null}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{formatWhen(account.lastWebhookAt)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button
                          size="small"
                          disabled={Boolean(busyId)}
                          onClick={() => { setRepairing(account); setRepairWabaId(account.wabaId || ''); }}
                        >
                          Fix WABA
                        </Button>
                        <Button size="small" color="error" disabled={Boolean(busyId)} onClick={() => setPendingDelete(account)}>
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : null}
      </Stack>

      <Dialog open={Boolean(repairing)} onClose={() => (busyId ? null : setRepairing(null))} fullWidth maxWidth="sm">
        <DialogTitle>Set the WhatsApp Business Account ID</DialogTitle>
        <DialogContent>
          <DialogContentText component="div" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Phone number ID <strong>{repairing?.phoneNumberId}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Find this under WhatsApp → API Setup as &quot;WhatsApp Business Account ID&quot;. It is <em>not</em> the
              Meta App ID or the business portfolio id — those sit beside it and look identical. Saving also
              subscribes this app to the WABA, which is what lets inbound messages arrive.
            </Typography>
          </DialogContentText>
          <TextField
            label="WABA ID"
            value={repairWabaId}
            onChange={(event) => setRepairWabaId(event.target.value)}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRepairing(null)} disabled={Boolean(busyId)}>Cancel</Button>
          <Button variant="contained" onClick={handleRepair} disabled={Boolean(busyId) || !repairWabaId.trim()}>
            Save and subscribe
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pendingDelete)} onClose={() => (busyId ? null : setPendingDelete(null))}>
        <DialogTitle>Delete this account?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Phone number ID <strong>{pendingDelete?.phoneNumberId || 'unknown'}</strong>, WABA{' '}
              <strong>{pendingDelete?.wabaId || 'none'}</strong>
              {pendingDelete?.owner ? <> , owned by {pendingDelete.owner.mobile}</> : ' , with no owner'}.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The account row is removed. The user, if any, keeps their sign-in, and conversation history stays.
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)} disabled={Boolean(busyId)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={Boolean(busyId)}>
            Delete account
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
