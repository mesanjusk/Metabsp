import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PropTypes from 'prop-types';
import Modal from '../common/Modal';
import { toast } from '../Toast';
import { parseApiError } from '../../utils/parseApiError';
import {
  fetchWhatsAppAccounts,
  activateWhatsAppAccount,
  deleteWhatsAppAccount,
  setSystemUserToken,
} from '../../services/whatsappCloudService';

const STATUS_COLOR = {
  active: 'success',
  pending: 'warning',
  error: 'error',
  disconnected: 'default',
};

function accountLabel(account) {
  return account.verifiedName || account.displayPhoneNumber || account.phoneNumberId || 'WhatsApp number';
}

// Lists every WhatsApp number/WABA connected to this user (the backend has
// always supported multiple — GET /api/whatsapp/accounts,
// POST /accounts/:id/activate — but no UI ever called them) and lets the
// user switch which one is active, or connect another.
export default function WhatsAppNumbersPanel({ onConnect, onManualConnect, onChanged, accountActionLoading }) {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingAccountId, setPendingAccountId] = useState('');
  const [systemUserModalAccountId, setSystemUserModalAccountId] = useState('');
  const [systemUserForm, setSystemUserForm] = useState({ accessToken: '', systemUserId: '' });
  const [isSavingSystemUserToken, setIsSavingSystemUserToken] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetchWhatsAppAccounts();
      const data = res?.data?.data || res?.data || [];
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(parseApiError(err, 'Could not load connected WhatsApp numbers.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleActivate = async (accountId) => {
    setPendingAccountId(accountId);
    try {
      await activateWhatsAppAccount(accountId);
      toast.success('Switched active WhatsApp number.');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(parseApiError(err, 'Could not switch to that number.'));
    } finally {
      setPendingAccountId('');
    }
  };

  const handleRemove = async (accountId) => {
    setPendingAccountId(accountId);
    try {
      await deleteWhatsAppAccount(accountId);
      toast.success('Removed WhatsApp number.');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(parseApiError(err, 'Could not remove that number.'));
    } finally {
      setPendingAccountId('');
    }
  };

  const closeSystemUserModal = useCallback(() => {
    setSystemUserModalAccountId('');
    setSystemUserForm({ accessToken: '', systemUserId: '' });
  }, []);

  const handleSaveSystemUserToken = async (event) => {
    event.preventDefault();
    if (!systemUserForm.accessToken.trim()) return toast.error('Paste the System User access token first.');

    setIsSavingSystemUserToken(true);
    try {
      await setSystemUserToken(systemUserModalAccountId, {
        accessToken: systemUserForm.accessToken.trim(),
        systemUserId: systemUserForm.systemUserId.trim(),
      });
      toast.success('System User token saved — this number no longer relies on a personal login token.');
      closeSystemUserModal();
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(parseApiError(err, 'Could not verify that token against this number.'));
    } finally {
      setIsSavingSystemUserToken(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>Connected WhatsApp numbers</Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={onConnect} disabled={accountActionLoading}>
            Connect another number
          </Button>
          <Button size="small" variant="text" onClick={onManualConnect} disabled={accountActionLoading}>
            Connect manually
          </Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert> : null}

      {isLoading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">Loading numbers...</Typography>
        </Stack>
      ) : accounts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No WhatsApp numbers connected yet.</Typography>
      ) : (
        <List dense disablePadding>
          {accounts.map((account) => {
            const id = account.id || account._id;
            const isBusy = pendingAccountId === id;
            return (
              <ListItem
                key={id}
                divider
                secondaryAction={
                  <Stack direction="row" spacing={1}>
                    {!account.isActive ? (
                      <Button size="small" variant="outlined" onClick={() => handleActivate(id)} disabled={isBusy}>
                        {isBusy ? 'Switching…' : 'Switch to this'}
                      </Button>
                    ) : (
                      <Chip size="small" color="primary" label="Active" />
                    )}
                    <Button size="small" variant="text" onClick={() => setSystemUserModalAccountId(id)} disabled={isBusy}>
                      System User token
                    </Button>
                    <Button size="small" color="error" variant="text" onClick={() => handleRemove(id)} disabled={isBusy}>
                      Remove
                    </Button>
                  </Stack>
                }
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={600}>{accountLabel(account)}</Typography>
                      <Chip size="small" label={account.status || 'unknown'} color={STATUS_COLOR[account.status] || 'default'} variant="outlined" />
                      {account.tokenSource === 'system_user' ? (
                        <Chip size="small" label="System User token" color="info" variant="outlined" />
                      ) : null}
                    </Stack>
                  }
                  secondary={account.displayPhoneNumber || account.phoneNumberId}
                />
              </ListItem>
            );
          })}
        </List>
      )}

      {systemUserModalAccountId ? (
        <Modal onClose={closeSystemUserModal} title="Add a System User access token">
          <Stack component="form" onSubmit={handleSaveSystemUserToken} spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Meta recommends a Business-owned System User token (generated in Meta Business Manager, usually set to never
              expire) instead of a token tied to one admin's personal login. Generate one there, then paste it here — it's
              verified against this number before saving.
            </Typography>
            <TextField
              label="System User access token"
              multiline
              rows={3}
              value={systemUserForm.accessToken}
              onChange={(e) => setSystemUserForm((prev) => ({ ...prev, accessToken: e.target.value }))}
            />
            <TextField
              label="System User ID (optional)"
              value={systemUserForm.systemUserId}
              onChange={(e) => setSystemUserForm((prev) => ({ ...prev, systemUserId: e.target.value }))}
            />
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button type="button" onClick={closeSystemUserModal} variant="outlined">Cancel</Button>
              <Button type="submit" variant="contained" disabled={isSavingSystemUserToken}>
                {isSavingSystemUserToken ? 'Verifying…' : 'Verify & save'}
              </Button>
            </Stack>
          </Stack>
        </Modal>
      ) : null}
    </Box>
  );
}

WhatsAppNumbersPanel.propTypes = {
  onConnect: PropTypes.func,
  onManualConnect: PropTypes.func,
  onChanged: PropTypes.func,
  accountActionLoading: PropTypes.bool,
};

WhatsAppNumbersPanel.defaultProps = {
  onConnect: () => {},
  onManualConnect: () => {},
  onChanged: () => {},
  accountActionLoading: false,
};
