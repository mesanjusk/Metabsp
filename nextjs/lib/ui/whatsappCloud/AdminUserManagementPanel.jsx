'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import { toast } from '@/lib/ui/components/Toast';
import {
  createManagedUser,
  deleteManagedUser,
  fetchManagedUsers,
  updateManagedUser,
} from '@/lib/client/services/whatsappCloudService';
import { useAuth } from '@/lib/ui/AuthContext';
import { parseApiError } from '@/lib/api/parseApiError';
import { canWriteWhatsAppAccount } from '@/lib/services/adminAccountEdit';

const emptyForm = {
  id: '',
  Display_name: '',
  Password: '',
  Mobile_number: '',
  User_group: 'user',
  accessToken: '',
  phoneNumberId: '',
  businessAccountId: '',
  wabaId: '',
  displayPhoneNumber: '',
  verifiedName: '',
  webhookSubscribed: false,
  clearAccount: false,
  hasAccount: false,
};

const mapUserToForm = (item) => ({
  id: item?.id || '',
  Display_name: item?.Display_name || '',
  Password: '',
  Mobile_number: item?.Mobile_number || item?.User_name || '',
  User_group: item?.User_group || 'user',
  accessToken: '',
  phoneNumberId: item?.whatsappAccount?.phoneNumberId || '',
  businessAccountId: item?.whatsappAccount?.businessAccountId || '',
  wabaId: item?.whatsappAccount?.wabaId || '',
  displayPhoneNumber: item?.whatsappAccount?.displayPhoneNumber || '',
  verifiedName: item?.whatsappAccount?.verifiedName || '',
  webhookSubscribed: Boolean(item?.whatsappAccount?.webhookSubscribed),
  clearAccount: false,
  // Whether there is an account to correct, as opposed to one to create. The
  // token is required only for the second.
  hasAccount: Boolean(item?.whatsappAccount?.phoneNumberId),
});

export default function AdminUserManagementPanel() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetchManagedUsers();
      const nextItems = response?.data?.items || response?.data?.data?.items || [];
      setItems(Array.isArray(nextItems) ? nextItems : []);
    } catch (loadError) {
      setError(parseApiError(loadError, 'Failed to load managed users.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const submitLabel = form.id ? 'Update user' : 'Create user';
  const canSubmit = useMemo(() => {
    if (!form.Mobile_number.trim()) return false;
    if (!form.id && !form.Password.trim()) return false;
    // The same rule the server applies, from the same module, because the two
    // disagreeing is how this button came to be permanently disabled: the form
    // preloads the stored ids and cannot preload the token (the API strips it),
    // so "any id present without a token" was always true for every user who
    // had an account. Correcting a wrong WABA id was unreachable from the one
    // screen built to do it.
    const mentionsAccount = Boolean(
      form.accessToken || form.phoneNumberId || form.businessAccountId || form.wabaId
    );
    if (
      mentionsAccount &&
      !canWriteWhatsAppAccount({
        hasExistingAccount: form.hasAccount,
        accessToken: form.accessToken.trim(),
        phoneNumberId: form.phoneNumberId.trim(),
        businessAccountId: form.businessAccountId.trim(),
        wabaId: form.wabaId.trim(),
      })
    ) {
      return false;
    }
    return true;
  }, [form]);

  const handleChange = (field) => (event) => {
    const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Held as the whole row, not just an id, so the confirmation can name the
  // number and the WhatsApp account that go with it. "Delete user?" on its own
  // is not enough information to consent to deleting a connected number.
  const { mobileNumber: signedInMobile } = useAuth();
  // Matched on the mobile number because that is what people sign in with and
  // what the table shows; the session carries no user id. The server refuses
  // self-deletion regardless — this only keeps the button from offering it.
  const isOwnAccount = (item) =>
    Boolean(signedInMobile) &&
    String(item?.Mobile_number || item?.User_name || '').trim() === String(signedInMobile).trim();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setError('');
    try {
      const response = await deleteManagedUser(pendingDelete.id);
      toast.success(response?.data?.message || 'User removed.');
      // If the deleted user was loaded into the form, the form is now editing
      // something that no longer exists.
      if (form.id === pendingDelete.id) handleReset();
      setPendingDelete(null);
      await loadUsers();
    } catch (err) {
      setError(parseApiError(err, 'Could not delete this user.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (item) => {
    setForm(mapUserToForm(item));
    setError('');
  };

  const handleReset = () => {
    setForm(emptyForm);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    const payload = {
      Display_name: form.Display_name.trim(),
      Password: form.Password,
      Mobile_number: form.Mobile_number.trim(),
      User_group: form.User_group.trim() || 'user',
      whatsapp: {
        accessToken: form.accessToken.trim(),
        phoneNumberId: form.phoneNumberId.trim(),
        businessAccountId: form.businessAccountId.trim(),
        wabaId: form.wabaId.trim(),
        displayPhoneNumber: form.displayPhoneNumber.trim(),
        verifiedName: form.verifiedName.trim(),
        webhookSubscribed: form.webhookSubscribed,
        clearAccount: form.clearAccount,
      },
    };

    if (form.id && !payload.Password.trim()) {
      delete payload.Password;
    }

    try {
      if (form.id) {
        await updateManagedUser(form.id, payload);
        toast.success('User updated successfully.');
      } else {
        await createManagedUser(payload);
        toast.success('User created successfully.');
      }
      handleReset();
      await loadUsers();
    } catch (saveError) {
      setError(parseApiError(saveError, 'Failed to save user.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', overflow: 'auto' }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Admin user management</Typography>
            <Typography variant="body2" color="text.secondary">
              Create sign-in accounts and save their WhatsApp token, phone number ID, business account ID and WABA ID directly in the database. People sign in with their mobile number — there is no separate username.
            </Typography>
          </Box>
          <Button startIcon={<RefreshRoundedIcon />} variant="outlined" onClick={loadUsers} disabled={isLoading || isSaving}>
            Refresh users
          </Button>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, md: 2.5 } }}>
          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ManageAccountsRoundedIcon color="success" />
              <Typography variant="h6" fontWeight={700}>{submitLabel}</Typography>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}><TextField label="Mobile number" value={form.Mobile_number} onChange={handleChange('Mobile_number')} fullWidth required type="tel" inputProps={{ inputMode: 'tel' }} helperText="This is how they sign in" /></Grid>
              <Grid item xs={12} md={4}><TextField label={form.id ? 'New password (optional)' : 'Password'} type="password" value={form.Password} onChange={handleChange('Password')} fullWidth required={!form.id} /></Grid>
              <Grid item xs={12} md={4}><TextField label="Display name (optional)" value={form.Display_name} onChange={handleChange('Display_name')} fullWidth helperText="Shown in the app only" /></Grid>
              <Grid item xs={12} md={3}><TextField label="User group" value={form.User_group} onChange={handleChange('User_group')} fullWidth helperText="Use user or admin" /></Grid>
              <Grid item xs={12} md={9}><TextField label="WhatsApp access token" value={form.accessToken} onChange={handleChange('accessToken')} fullWidth multiline minRows={2} /></Grid>
              <Grid item xs={12} md={3}><TextField label="Phone number ID" value={form.phoneNumberId} onChange={handleChange('phoneNumberId')} fullWidth /></Grid>
              <Grid item xs={12} md={3}><TextField label="Business account ID" value={form.businessAccountId} onChange={handleChange('businessAccountId')} fullWidth /></Grid>
              <Grid item xs={12} md={3}><TextField label="WABA ID" value={form.wabaId} onChange={handleChange('wabaId')} fullWidth /></Grid>
              <Grid item xs={12} md={3}><TextField label="Display phone number" value={form.displayPhoneNumber} onChange={handleChange('displayPhoneNumber')} fullWidth /></Grid>
              <Grid item xs={12} md={6}><TextField label="Verified name" value={form.verifiedName} onChange={handleChange('verifiedName')} fullWidth /></Grid>
              <Grid item xs={12} md={3}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: '100%', px: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                  <Typography variant="body2">Webhook subscribed</Typography>
                  <Switch checked={form.webhookSubscribed} onChange={handleChange('webhookSubscribed')} />
                </Stack>
              </Grid>
              <Grid item xs={12} md={3}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: '100%', px: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                  <Typography variant="body2">Clear saved account</Typography>
                  <Switch checked={form.clearAccount} onChange={handleChange('clearAccount')} />
                </Stack>
              </Grid>
            </Grid>

            <Stack direction="row" spacing={1.25}>
              <Button type="submit" variant="contained" disabled={!canSubmit || isSaving} startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : form.id ? <SaveRoundedIcon /> : <AddRoundedIcon />}>
                {isSaving ? 'Saving...' : submitLabel}
              </Button>
              <Button variant="text" onClick={handleReset} disabled={isSaving}>Clear form</Button>
            </Stack>
          </Stack>
        </Paper>

        <Divider />

        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Sign-in number</TableCell>
                  <TableCell>Group</TableCell>
                  <TableCell>Phone Number ID</TableCell>
                  <TableCell>Business/WABA</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6}><Stack alignItems="center" py={3}><CircularProgress size={24} /></Stack></TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><Typography sx={{ py: 3, textAlign: 'center' }} color="text.secondary">No users created yet.</Typography></TableCell></TableRow>
                ) : (
                  items.map((item) => {
                    const account = item?.whatsappAccount;
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Stack spacing={0.25}>
                            <Typography fontWeight={700}>{item.Mobile_number || item.User_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{item.Display_name || account?.verifiedName || 'No display name'}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell><Chip size="small" label={item.User_group || 'user'} color={String(item.User_group).toLowerCase() === 'admin' ? 'warning' : 'default'} /></TableCell>
                        <TableCell>{account?.phoneNumberId || '-'}</TableCell>
                        <TableCell>
                          <Stack spacing={0.25}>
                            <Typography variant="body2">{account?.businessAccountId || '-'}</Typography>
                            <Typography variant="caption" color="text.secondary">WABA: {account?.wabaId || '-'}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                            <Chip size="small" label={account?.status || 'No account'} color={account ? 'success' : 'default'} />
                            {account?.webhookSubscribed ? <Chip size="small" label="Webhook" color="info" /> : null}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Button size="small" onClick={() => handleEdit(item)}>Edit</Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => setPendingDelete(item)}
                              // The panel is the only way to manage these
                              // accounts, so deleting your own sign-in would
                              // lock everyone out of it.
                              disabled={isOwnAccount(item)}
                            >
                              Delete
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      </Stack>

      {/* Deleting a user takes their connected number with it, so the
          confirmation names both. "Delete user?" alone is not enough to
          consent to disconnecting a WhatsApp number. */}
      <Dialog open={Boolean(pendingDelete)} onClose={() => (isDeleting ? null : setPendingDelete(null))}>
        <DialogTitle>Delete this user?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              {pendingDelete?.Mobile_number || pendingDelete?.User_name}
              {pendingDelete?.Display_name ? ` — ${pendingDelete.Display_name}` : ''}
            </Typography>
            {pendingDelete?.whatsappAccount ? (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                Their connected WhatsApp account is deleted too — phone number ID{' '}
                <strong>{pendingDelete.whatsappAccount.phoneNumberId || 'unknown'}</strong>
                {pendingDelete.whatsappAccount.wabaId ? <> , WABA {pendingDelete.whatsappAccount.wabaId}</> : null}.
                Inbound messages for that number stop arriving through this user.
              </Alert>
            ) : null}
            <Typography variant="body2" color="text.secondary">
              This cannot be undone. Their conversation history stays in the database.
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)} disabled={isDeleting}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={18} color="inherit" /> : null}
          >
            Delete user
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
