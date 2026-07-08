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
  Typography,
} from '@mui/material';
import PropTypes from 'prop-types';
import { toast } from '../Toast';
import { parseApiError } from '../../utils/parseApiError';
import {
  fetchWhatsAppAccounts,
  activateWhatsAppAccount,
  deleteWhatsAppAccount,
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
                    </Stack>
                  }
                  secondary={account.displayPhoneNumber || account.phoneNumberId}
                />
              </ListItem>
            );
          })}
        </List>
      )}
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
