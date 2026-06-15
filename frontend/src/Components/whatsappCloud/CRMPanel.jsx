import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { toast } from '../../Components/Toast';
import { parseApiError } from '../../utils/parseApiError';
import { parseContactsFromRows, parseTabularFile } from '../../utils/importParsers';
import { whatsappCloudService } from '../../services/whatsappCloudService';

export default function CRMPanel({ search = '' }) {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', tags: '' });

  const loadContacts = async () => {
    try {
      const response = await whatsappCloudService.getContacts();
      setContacts(Array.isArray(response?.data?.data) ? response.data.data : []);
    } catch (error) {
      toast.error(parseApiError(error, 'Failed to load contacts.'));
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => `${contact.name} ${contact.phone} ${(contact.tags || []).join(' ')}`.toLowerCase().includes(query));
  }, [contacts, search]);

  const handleCreate = async () => {
    const phone = form.phone.replace(/\D/g, '');
    if (!phone) return toast.error('Phone number is required.');
    try {
      await whatsappCloudService.createContact({ name: form.name, phone, tags: form.tags });
      setForm({ name: '', phone: '', tags: '' });
      await loadContacts();
      toast.success('Contact saved.');
    } catch (error) {
      toast.error(parseApiError(error, 'Could not save contact.'));
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseTabularFile(file);
      const parsed = parseContactsFromRows(rows);
      if (!parsed.length) return toast.error('No valid contacts found in the file.');
      await whatsappCloudService.importContacts(parsed);
      await loadContacts();
      toast.success(`${parsed.length} contacts imported.`);
    } catch (error) {
      toast.error(parseApiError(error, 'Could not import contacts.'));
    } finally {
      event.target.value = '';
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: { xs: 0, md: 3 }, height: '100%', overflow: 'auto' }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" fontWeight={700}>CRM Contacts</Typography>
          <Typography variant="body2" color="text.secondary">Add contacts one by one or import them in bulk from CSV / Excel.</Typography>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
          <TextField label="Name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} fullWidth />
          <TextField label="Phone" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} fullWidth />
          <TextField label="Tags" value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} fullWidth />
          <Button variant="contained" onClick={handleCreate}>Save</Button>
        </Stack>

        <Button component="label" variant="outlined" startIcon={<UploadFileRoundedIcon />} sx={{ width: 'fit-content' }}>
          Import CSV / Excel
          <input type="file" accept=".csv,.xlsx,.xls" hidden onChange={handleImport} />
        </Button>

        <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Tags</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredContacts.length ? filteredContacts.map((contact) => (
                <TableRow key={contact._id || contact.phone}>
                  <TableCell>{contact.name || '-'}</TableCell>
                  <TableCell>{contact.phone}</TableCell>
                  <TableCell>{Array.isArray(contact.tags) ? contact.tags.join(', ') : '-'}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={3} align="center">No contacts found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Stack>
    </Paper>
  );
}
