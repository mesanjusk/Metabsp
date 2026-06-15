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
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import { toast } from '../Toast';
import { createManagedUser, fetchManagedUsers, updateManagedUser } from '../../services/whatsappCloudService';
import { parseApiError } from '../../utils/parseApiError';

const emptyForm = {
  id: '',
  User_name: '',
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
};

const mapUserToForm = (item) => ({
  id: item?.id || '',
  User_name: item?.User_name || '',
  Password: '',
  Mobile_number: item?.Mobile_number || '',
  User_group: item?.User_group || 'user',
  accessToken: '',
  phoneNumberId: item?.whatsappAccount?.phoneNumberId || '',
  businessAccountId: item?.whatsappAccount?.businessAccountId || '',
  wabaId: item?.whatsappAccount?.wabaId || '',
  displayPhoneNumber: item?.whatsappAccount?.displayPhoneNumber || '',
  verifiedName: item?.whatsappAccount?.verifiedName || '',
  webhookSubscribed: Boolean(item?.whatsappAccount?.webhookSubscribed),
  clearAccount: false,
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
    if (!form.User_name.trim()) return false;
    if (!form.id && !form.Password.trim()) return false;
    if ((form.accessToken || form.phoneNumberId || form.businessAccountId || form.wabaId) && !form.accessToken.trim()) return false;
    return true;
  }, [form]);

  const handleChange = (field) => (event) => {
    const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
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
      User_name: form.User_name.trim(),
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
              Create login users and save their WhatsApp token, phone number ID, business account ID, and WABA ID directly in the database.
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
              <Grid item xs={12} md={4}><TextField label="User name" value={form.User_name} onChange={handleChange('User_name')} fullWidth required /></Grid>
              <Grid item xs={12} md={4}><TextField label={form.id ? 'New password (optional)' : 'Password'} type="password" value={form.Password} onChange={handleChange('Password')} fullWidth required={!form.id} /></Grid>
              <Grid item xs={12} md={4}><TextField label="Mobile number" value={form.Mobile_number} onChange={handleChange('Mobile_number')} fullWidth /></Grid>
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
                  <TableCell>User</TableCell>
                  <TableCell>Group</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>Phone Number ID</TableCell>
                  <TableCell>Business/WABA</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7}><Stack alignItems="center" py={3}><CircularProgress size={24} /></Stack></TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={7}><Typography sx={{ py: 3, textAlign: 'center' }} color="text.secondary">No users created yet.</Typography></TableCell></TableRow>
                ) : (
                  items.map((item) => {
                    const account = item?.whatsappAccount;
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Stack spacing={0.25}>
                            <Typography fontWeight={700}>{item.User_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{account?.verifiedName || 'No verified name'}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell><Chip size="small" label={item.User_group || 'user'} color={String(item.User_group).toLowerCase() === 'admin' ? 'warning' : 'default'} /></TableCell>
                        <TableCell>{item.Mobile_number || '-'}</TableCell>
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
                        <TableCell align="right"><Button size="small" onClick={() => handleEdit(item)}>Edit</Button></TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}
