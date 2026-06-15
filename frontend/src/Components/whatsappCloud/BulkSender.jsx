import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { toast } from '../../Components/Toast';
import { parseApiError } from '../../utils/parseApiError';
import { parseContactsFromRows, parseTabularFile } from '../../utils/importParsers';
import { whatsappCloudService } from '../../services/whatsappCloudService';
import TemplateSelector from './TemplateSelector';

const splitNumbers = (rawValue) =>
  String(rawValue || '')
    .split(/[\n,;\s]+/)
    .map((item) => item.replace(/\D/g, '').trim())
    .filter(Boolean);

export default function BulkSender({ standalone, search }) {
  const [numbersText, setNumbersText] = useState('');
  const [template, setTemplate] = useState(null);
  const [messageType, setMessageType] = useState('template');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ total: 0, processed: 0, success: 0, failed: 0 });
  const [contacts, setContacts] = useState([]);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const numbers = useMemo(() => [...new Set(splitNumbers(numbersText))], [numbersText]);

  const loadContacts = async () => {
    try {
      const response = await whatsappCloudService.getContacts();
      const list = response?.data?.data || [];
      setContacts(Array.isArray(list) ? list : []);
    } catch (_error) {
      setContacts([]);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const rows = await parseTabularFile(file);
      const importedContacts = parseContactsFromRows(rows);
      const importedNumbers = importedContacts.map((item) => item.phone);
      if (!importedNumbers.length) {
        toast.error('No valid phone numbers found in the file.');
        return;
      }
      setNumbersText((prev) => `${prev.trim()}\n${importedNumbers.join('\n')}`.trim());
      toast.success(`${importedNumbers.length} recipients added.`);
    } catch (error) {
      toast.error(parseApiError(error, 'Could not read the uploaded file.'));
    } finally {
      event.target.value = '';
    }
  };

  const handleAddContact = async () => {
    const phone = contactPhone.replace(/\D/g, '');
    if (!phone) return toast.error('Phone number is required.');
    try {
      await whatsappCloudService.createContact({ name: contactName, phone });
      setContactName('');
      setContactPhone('');
      setNumbersText((prev) => `${prev.trim()}\n${phone}`.trim());
      await loadContacts();
      toast.success('Contact added.');
    } catch (error) {
      toast.error(parseApiError(error, 'Could not add contact.'));
    }
  };

  const sendBulkMessages = async () => {
    if (!numbers.length) return toast.error('Please provide at least 1 recipient number.');
    if (messageType === 'template' && !template?.name) return toast.error('Please select a template first.');
    if (messageType === 'text' && !messageText.trim()) return toast.error('Please enter a message.');

    setIsSending(true);
    setProgress({ total: numbers.length, processed: 0, success: 0, failed: 0 });

    try {
      const response = await whatsappCloudService.sendBroadcast({
        recipients: numbers,
        messageType,
        text: messageType === 'text' ? messageText.trim() : undefined,
        templateName: messageType === 'template' ? template.name : undefined,
        language: messageType === 'template' ? template.language : undefined,
        components: [],
      });

      const results = Array.isArray(response?.data?.results) ? response.data.results : [];
      const success = results.filter((item) => item.success).length;
      const failed = results.length - success;
      setProgress({ total: numbers.length, processed: numbers.length, success, failed });

      if (failed) toast.error(`${failed} message(s) failed. ${success} sent successfully.`);
      else toast.success(`${success} messages sent successfully.`);
    } catch (error) {
      toast.error(parseApiError(error, 'Broadcast failed.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: standalone ? 0 : 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Broadcast Campaign</Typography>
          <Typography variant="body2" color="text.secondary">
            Send template or text messages using manual numbers, CSV/XLSX import, or saved CRM contacts.
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
          <TextField
            select
            label="Message type"
            value={messageType}
            onChange={(event) => setMessageType(event.target.value)}
            SelectProps={{ native: true }}
            sx={{ minWidth: 180 }}
          >
            <option value="template">Template</option>
            <option value="text">Text</option>
          </TextField>
          {messageType === 'text' ? (
            <TextField
              fullWidth
              label="Broadcast message"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              multiline
              minRows={2}
            />
          ) : (
            <Box sx={{ flex: 1 }}>
              <TemplateSelector
                selectedTemplate={template}
                onTemplateChange={setTemplate}
                disabled={isSending}
                searchQuery={search}
              />
            </Box>
          )}
        </Stack>

        <TextField
          multiline
          rows={5}
          disabled={isSending}
          value={numbersText}
          onChange={(event) => setNumbersText(event.target.value)}
          label="Recipient numbers"
          helperText="One number per line or comma separated"
          placeholder={'+14155552671\n+14155552672'}
        />

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }}>
          <Button component="label" variant="outlined" startIcon={<UploadFileRoundedIcon />} sx={{ width: 'fit-content' }}>
            Import CSV / Excel
            <input type="file" accept=".csv,.xlsx,.xls" hidden onChange={handleFileUpload} />
          </Button>
          <Chip label={`Saved contacts: ${contacts.length}`} size="small" />
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
          <TextField label="Quick add contact name" value={contactName} onChange={(event) => setContactName(event.target.value)} fullWidth />
          <TextField label="Quick add phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} fullWidth />
          <Button variant="outlined" onClick={handleAddContact} startIcon={<AddRoundedIcon />}>Add contact</Button>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
          <Button variant="contained" onClick={sendBulkMessages} disabled={isSending || numbers.length === 0}>
            {isSending ? 'Sending Broadcast…' : 'Send Broadcast'}
          </Button>
          <Typography variant="caption" color="text.secondary">Recipients: {numbers.length}</Typography>
        </Stack>

        {isSending || progress.processed ? (
          <LinearProgress variant="determinate" value={(progress.processed / Math.max(progress.total, 1)) * 100} />
        ) : null}

        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Typography variant="body2">Total: <strong>{progress.total}</strong></Typography>
          <Typography variant="body2">Processed: <strong>{progress.processed}</strong></Typography>
          <Typography variant="body2" color="success.main">Success: <strong>{progress.success}</strong></Typography>
          <Typography variant="body2" color="error.main">Failed: <strong>{progress.failed}</strong></Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

BulkSender.propTypes = {
  standalone: PropTypes.bool,
  search: PropTypes.string,
};

BulkSender.defaultProps = {
  standalone: false,
  search: '',
};
