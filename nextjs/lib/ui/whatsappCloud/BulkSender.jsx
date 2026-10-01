'use client';

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
import { toast } from '@/lib/ui/components/Toast';
import { parseApiError } from '@/lib/api/parseApiError';
import { parseContactsFromRows, parseTabularFile } from '@/lib/client/importParsers';
import { whatsappCloudService } from '@/lib/client/services/whatsappCloudService';
import TemplateSelector from './TemplateSelector';

const splitNumbers = (rawValue) =>
  String(rawValue || '')
    .split(/[\n,;\s]+/)
    .map((item) => item.replace(/\D/g, '').trim())
    .filter(Boolean);

const campaignStatusColor = (status) => {
  if (status === 'queued') return 'success';
  if (status === 'scheduled' || status === 'processing') return 'info';
  if (status === 'failed') return 'error';
  return 'default';
};

export default function BulkSender({ standalone, search }) {
  const [numbersText, setNumbersText] = useState('');
  const [template, setTemplate] = useState(null);
  const [messageType, setMessageType] = useState('template');
  const [messageText, setMessageText] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ total: 0, processed: 0, success: 0, failed: 0 });
  const [contacts, setContacts] = useState([]);
  const [scheduledCampaigns, setScheduledCampaigns] = useState([]);
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

  const loadCampaigns = async () => {
    try {
      const response = await whatsappCloudService.getBroadcasts();
      const list = response?.data?.data || [];
      setScheduledCampaigns(Array.isArray(list) ? list : []);
    } catch (_error) {
      setScheduledCampaigns([]);
    }
  };

  useEffect(() => {
    loadContacts();
    loadCampaigns();
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

  const cancelCampaign = async (campaign) => {
    try {
      await whatsappCloudService.cancelBroadcast(campaign.id);
      toast.success('Scheduled campaign cancelled.');
      await loadCampaigns();
    } catch (error) {
      toast.error(parseApiError(error, 'Could not cancel the campaign.'));
    }
  };

  const sendBulkMessages = async () => {
    if (!numbers.length) return toast.error('Please provide at least 1 recipient number.');
    if (messageType === 'template' && !template?.name) return toast.error('Please select a template first.');
    if (messageType === 'text' && !messageText.trim()) return toast.error('Please enter a message.');

    let scheduledIso;
    if (scheduleAt) {
      if (messageType !== 'template') return toast.error('Scheduled campaigns must use an approved WhatsApp template.');
      const scheduledTime = new Date(scheduleAt);
      if (Number.isNaN(scheduledTime.getTime()) || scheduledTime.getTime() <= Date.now()) {
        return toast.error('Choose a future date and time for the campaign.');
      }
      scheduledIso = scheduledTime.toISOString();
    }

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
        scheduleAt: scheduledIso,
      });

      if (response?.data?.scheduled) {
        setProgress({ total: numbers.length, processed: 0, success: 0, failed: 0 });
        setScheduleAt('');
        await loadCampaigns();
        toast.success(`Campaign scheduled for ${new Date(response.data.campaign?.dueAt || scheduledIso).toLocaleString()}.`);
        return;
      }

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

  const recentCampaigns = scheduledCampaigns.slice(0, 8);

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: standalone ? 0 : 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Broadcast Campaign</Typography>
          <Typography variant="body2" color="text.secondary">
            Send now or schedule an approved template using manual numbers, CSV/XLSX import, or saved CRM contacts.
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
          type="datetime-local"
          label="Schedule campaign (optional)"
          value={scheduleAt}
          onChange={(event) => setScheduleAt(event.target.value)}
          disabled={isSending}
          InputLabelProps={{ shrink: true }}
          helperText="Leave blank to send now. Scheduled campaigns use approved templates only and are stored durably until their send time."
          sx={{ maxWidth: 420 }}
        />

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
            {isSending ? (scheduleAt ? 'Scheduling…' : 'Sending Broadcast…') : (scheduleAt ? 'Schedule Campaign' : 'Send Broadcast')}
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

        {recentCampaigns.length ? (
          <Box sx={{ pt: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Recent scheduled campaigns</Typography>
            <Stack spacing={1}>
              {recentCampaigns.map((campaign) => (
                <Paper key={campaign.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" fontWeight={700}>{campaign.title || campaign.templateName || 'Campaign'}</Typography>
                        <Chip size="small" variant="outlined" color={campaignStatusColor(campaign.status)} label={campaign.status || 'unknown'} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {campaign.recipientCount || 0} recipients · {campaign.dueAt ? new Date(campaign.dueAt).toLocaleString() : 'No schedule time'}
                      </Typography>
                      {campaign.lastError ? <Typography variant="caption" color="error" display="block">{campaign.lastError}</Typography> : null}
                    </Box>
                    {campaign.status === 'scheduled' ? (
                      <Button size="small" color="error" variant="text" onClick={() => cancelCampaign(campaign)}>Cancel</Button>
                    ) : null}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        ) : null}
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
