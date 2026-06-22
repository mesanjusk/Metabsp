import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon    from '@mui/icons-material/Add';
import EditIcon   from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api';
import PageHeader from '../components/PageHeader';
import ResponsiveTable from '../components/ResponsiveTable';
import ResponsiveDialog from '../components/ResponsiveDialog';

const APP_NAME_OPTIONS = [
  'School',
  'Coaching',
  'Clinic',
  'Document Builder',
  'Print Ordering',
];

const emptyForm = { phoneNumberId: '', appName: APP_NAME_OPTIONS[0], appUrl: '', isActive: true };

function RouteDialog({ open, onClose, onSaved, editing }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing
        ? { phoneNumberId: editing.phoneNumberId, appName: editing.appName, appUrl: editing.appUrl, isActive: editing.isActive !== false }
        : emptyForm
      );
      setError('');
    }
  }, [open, editing]);

  const save = async () => {
    if (!form.phoneNumberId.trim()) return setError('Phone Number ID is required');
    if (!form.appUrl.trim()) return setError('App URL is required');
    setSaving(true);
    try {
      if (editing?._id) {
        await api.put(`/routing/${editing._id}`, form);
      } else {
        await api.post('/routing', form);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? 'Edit Route' : 'Add New Route'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            select
            label="App Name"
            value={form.appName}
            onChange={(e) => setForm({ ...form, appName: e.target.value })}
          >
            {APP_NAME_OPTIONS.map((name) => (
              <MenuItem key={name} value={name}>{name}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Phone Number ID"
            value={form.phoneNumberId}
            onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
            placeholder="e.g. 123456789012345"
            helperText="The phone_number_id from Meta webhook payload"
          />

          <TextField
            label="App URL"
            value={form.appUrl}
            onChange={(e) => setForm({ ...form, appUrl: e.target.value })}
            placeholder="https://your-app.com/webhook"
            helperText="Full URL where Meta payloads will be forwarded"
          />

          <FormControlLabel
            control={
              <Switch
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                color="success"
              />
            }
            label={form.isActive ? 'Active' : 'Inactive'}
          />

          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={onClose} disabled={saving}>Cancel</Button>
            <Button variant="contained" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </ResponsiveDialog>
  );
}

export default function RoutingAdminPage() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/routing');
      setRoutes(Array.isArray(data.data) ? data.data : []);
    } catch {
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (r) => { setEditing(r); setDialogOpen(true); };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this routing config?')) return;
    setDeleteError('');
    try {
      await api.delete(`/routing/${id}`);
      load();
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Delete failed');
    }
  };

  const columns = [
    { key: 'appName',       label: 'App Name' },
    { key: 'phoneNumberId', label: 'Phone Number ID' },
    { key: 'appUrl',        label: 'App URL' },
    { key: 'status',        label: 'Status' },
    { key: 'actions',       label: 'Actions' },
  ];

  const rows = routes.map((r) => ({
    title:         r.appName,
    appName:       r.appName,
    phoneNumberId: r.phoneNumberId,
    appUrl:        (
      <Typography variant="body2" sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.appUrl}
      </Typography>
    ),
    status: () => (
      <Chip
        size="small"
        label={r.isActive ? 'Active' : 'Inactive'}
        color={r.isActive ? 'success' : 'default'}
      />
    ),
    actions: () => (
      <Stack direction="row" spacing={0.5}>
        <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(r)}>Edit</Button>
        <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(r._id)}>Delete</Button>
      </Stack>
    ),
  }));

  return (
    <>
      <PageHeader
        title="Webhook Routing"
        subtitle="Map WhatsApp phone_number_id values to app URLs for automatic payload forwarding."
        chips={[{ label: `${routes.length} Route${routes.length !== 1 ? 's' : ''}` }]}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            Add New Route
          </Button>
        }
      />

      {deleteError ? <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert> : null}

      <Card>
        <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
          {loading ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>Loading…</Typography>
          ) : routes.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>No routing configs yet.</Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={openAdd} sx={{ mt: 1 }}>
                Add First Route
              </Button>
            </Box>
          ) : (
            <ResponsiveTable
              columns={columns}
              rows={rows}
              mobileTitleKey="title"
            />
          )}
        </CardContent>
      </Card>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>How it works</Typography>
          <Typography variant="body2" color="text.secondary">
            When Meta sends a webhook, this server reads the <code>phone_number_id</code> from the payload.
            If an active route exists for that ID, the full payload is forwarded to the configured App URL via POST.
            The original processing (messages, auto-reply, analytics) still happens as normal.
          </Typography>
        </CardContent>
      </Card>

      <RouteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
        editing={editing}
      />
    </>
  );
}
