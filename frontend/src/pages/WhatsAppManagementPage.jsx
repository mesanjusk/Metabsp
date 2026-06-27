import { useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, Grid, IconButton, InputLabel, MenuItem,
  Paper, Select, Skeleton, Stack, Step, StepContent, StepLabel, Stepper,
  Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  FileUpload as FileUploadIcon,
  Image as ImageIcon,
  InsertDriveFile as FileIcon,
  Phone as PhoneIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockPhoneNumbers = [
  { id: 1, number: '+1 415 555 0100', displayName: 'Acme Support', quality: 'HIGH', limit: '100K/day', optIn: '94%', status: 'Active' },
  { id: 2, number: '+44 20 7946 0101', displayName: 'Globex Sales', quality: 'MEDIUM', limit: '10K/day', optIn: '78%', status: 'Active' },
  { id: 3, number: '+91 98765 43210', displayName: 'Initech Help', quality: 'LOW', limit: '1K/day', optIn: '52%', status: 'Flagged' },
  { id: 4, number: '+49 30 12345678', displayName: 'Umbrella DE', quality: 'HIGH', limit: '100K/day', optIn: '88%', status: 'Active' },
];

const mockTemplates = [
  { id: 1, name: 'order_confirmation', category: 'UTILITY', language: 'en_US', status: 'APPROVED', buttons: 2, created: '2025-11-10' },
  { id: 2, name: 'summer_promo_2026', category: 'MARKETING', language: 'en_US', status: 'APPROVED', buttons: 1, created: '2026-01-15' },
  { id: 3, name: 'otp_login', category: 'AUTHENTICATION', language: 'en_US', status: 'APPROVED', buttons: 1, created: '2025-12-01' },
  { id: 4, name: 'shipping_update', category: 'UTILITY', language: 'en_GB', status: 'PENDING', buttons: 0, created: '2026-06-20' },
  { id: 5, name: 'reengagement_q2', category: 'MARKETING', language: 'de_DE', status: 'REJECTED', buttons: 2, created: '2026-04-03' },
  { id: 6, name: 'appointment_reminder', category: 'UTILITY', language: 'fr_FR', status: 'APPROVED', buttons: 1, created: '2026-02-28' },
];

const mockMessageLogs = [
  { id: 1, timestamp: '2026-06-27 14:32:01', from: '+1 415 555 0100', to: '+1 650 555 0200', type: 'Template', status: 'Delivered', direction: 'Outbound' },
  { id: 2, timestamp: '2026-06-27 14:31:47', from: '+1 650 555 0310', to: '+1 415 555 0100', type: 'Text', status: 'Read', direction: 'Inbound' },
  { id: 3, timestamp: '2026-06-27 14:30:55', from: '+1 415 555 0100', to: '+1 650 555 0410', type: 'Template', status: 'Failed', direction: 'Outbound' },
  { id: 4, timestamp: '2026-06-27 14:29:30', from: '+44 20 7946 0101', to: '+44 7700 900100', type: 'Image', status: 'Sent', direction: 'Outbound' },
  { id: 5, timestamp: '2026-06-27 14:28:12', from: '+49 30 12345678', to: '+49 151 23456789', type: 'Template', status: 'Delivered', direction: 'Outbound' },
  { id: 6, timestamp: '2026-06-27 14:27:05', from: '+1 650 555 0510', to: '+1 415 555 0100', type: 'Text', status: 'Read', direction: 'Inbound' },
];

const mockWebhookEvents = [
  { id: 1, timestamp: '2026-06-27 14:32:01', type: 'message', from: '+1 650 555 0200', preview: 'Hello, I need help with my order #45...', status: 'Processed' },
  { id: 2, timestamp: '2026-06-27 14:31:47', type: 'message_status', from: '+1 415 555 0100', preview: 'Message delivered to +1 650 555 0310', status: 'Processed' },
  { id: 3, timestamp: '2026-06-27 14:30:05', type: 'message', from: '+44 7700 900100', preview: 'Can you track my parcel?', status: 'Failed' },
  { id: 4, timestamp: '2026-06-27 14:29:30', type: 'message_status', from: '+49 30 12345678', preview: 'Message read by +49 151 23456789', status: 'Processed' },
  { id: 5, timestamp: '2026-06-27 14:28:12', type: 'template_status', from: 'Meta', preview: 'Template "shipping_update" approved', status: 'Processed' },
  { id: 6, timestamp: '2026-06-27 14:27:05', type: 'message', from: '+91 98765 00100', preview: 'Namaste, please help', status: 'Failed' },
];

const mockMedia = [
  { id: 1, name: 'promo_banner_june.jpg', type: 'image', size: '284 KB', uploaded: '2026-06-20' },
  { id: 2, name: 'product_catalog_q2.pdf', type: 'document', size: '1.2 MB', uploaded: '2026-06-18' },
  { id: 3, name: 'summer_offer.png', type: 'image', size: '512 KB', uploaded: '2026-06-15' },
  { id: 4, name: 'terms_and_conditions.pdf', type: 'document', size: '320 KB', uploaded: '2026-06-10' },
  { id: 5, name: 'store_logo.png', type: 'image', size: '96 KB', uploaded: '2026-05-30' },
  { id: 6, name: 'invoice_template.pdf', type: 'document', size: '88 KB', uploaded: '2026-05-25' },
];

const mockOptIns = [
  { id: 1, contact: '+1 650 555 0200', name: 'Alice Johnson', optIn: true, channel: 'Website', date: '2026-01-15' },
  { id: 2, contact: '+1 650 555 0310', name: 'Bob Smith', optIn: true, channel: 'SMS', date: '2026-02-20' },
  { id: 3, contact: '+1 650 555 0410', name: 'Carol White', optIn: false, channel: 'Website', date: '2026-03-10' },
  { id: 4, contact: '+44 7700 900100', name: 'David Brown', optIn: true, channel: 'App', date: '2026-04-05' },
  { id: 5, contact: '+49 151 23456789', name: 'Eva Müller', optIn: true, channel: 'App', date: '2026-05-12' },
  { id: 6, contact: '+91 98765 00100', name: 'Raj Sharma', optIn: false, channel: 'Website', date: '2026-06-01' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const qualityColor = (q) => ({ HIGH: 'success', MEDIUM: 'warning', LOW: 'error' }[q] || 'default');
const statusColor = (s) => ({
  APPROVED: 'success', PENDING: 'warning', REJECTED: 'error',
  Active: 'success', Flagged: 'error',
  Delivered: 'success', Read: 'info', Sent: 'default', Failed: 'error',
  Processed: 'success',
}[s] || 'default');
const catColor = (c) => ({ MARKETING: 'primary', UTILITY: 'info', AUTHENTICATION: 'secondary' }[c] || 'default');

function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={index}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.2 }}
      >
        <Box sx={{ pt: 2.5 }}>{children}</Box>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Template Wizard ──────────────────────────────────────────────────────────

const WIZARD_STEPS = ['Name', 'Category', 'Language', 'Body', 'Header / Footer', 'Buttons', 'Preview'];

function TemplateWizard({ open, onClose }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', category: '', language: '', body: '', header: '', footer: '', buttons: '' });

  const update = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const next = () => setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const stepContent = [
    <TextField label="Template Name" fullWidth value={form.name} onChange={update('name')} helperText="Lowercase, underscores only. e.g. order_confirmation" />,
    <FormControl fullWidth><InputLabel>Category</InputLabel><Select label="Category" value={form.category} onChange={update('category')}><MenuItem value="MARKETING">MARKETING</MenuItem><MenuItem value="UTILITY">UTILITY</MenuItem><MenuItem value="AUTHENTICATION">AUTHENTICATION</MenuItem></Select></FormControl>,
    <FormControl fullWidth><InputLabel>Language</InputLabel><Select label="Language" value={form.language} onChange={update('language')}><MenuItem value="en_US">English (US)</MenuItem><MenuItem value="en_GB">English (UK)</MenuItem><MenuItem value="de_DE">German</MenuItem><MenuItem value="fr_FR">French</MenuItem><MenuItem value="es_ES">Spanish</MenuItem><MenuItem value="pt_BR">Portuguese (BR)</MenuItem></Select></FormControl>,
    <TextField label="Message Body" fullWidth multiline rows={5} value={form.body} onChange={update('body')} helperText="Use {{1}}, {{2}} for variables. Max 1024 characters." />,
    <Stack spacing={2}><TextField label="Header Text (optional)" fullWidth value={form.header} onChange={update('header')} /><TextField label="Footer Text (optional)" fullWidth value={form.footer} onChange={update('footer')} /></Stack>,
    <TextField label="Button Labels (comma separated)" fullWidth value={form.buttons} onChange={update('buttons')} helperText="e.g. Track Order, Contact Support" />,
    <Box sx={{ bgcolor: '#ECE5DD', borderRadius: 3, p: 2, maxWidth: 280, mx: 'auto' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textAlign: 'center' }}>Preview</Typography>
      <Box sx={{ bgcolor: 'white', borderRadius: 2, p: 1.5, boxShadow: 1 }}>
        {form.header && <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>{form.header}</Typography>}
        <Typography variant="body2">{form.body || 'Your message body will appear here.'}</Typography>
        {form.footer && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{form.footer}</Typography>}
      </Box>
      {form.buttons && (
        <Stack spacing={0.5} mt={0.5}>
          {form.buttons.split(',').map((b, i) => (
            <Box key={i} sx={{ bgcolor: 'white', borderRadius: 2, p: 0.75, textAlign: 'center', cursor: 'default' }}>
              <Typography variant="body2" color="primary.main" fontWeight={600}>{b.trim()}</Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>,
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Create Template</DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3, mt: 1 }}>
          {WIZARD_STEPS.map((s) => <Step key={s}><StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.7rem' } }}>{s}</StepLabel></Step>)}
        </Stepper>
        {stepContent[step]}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={back} disabled={step === 0}>Back</Button>
        {step < WIZARD_STEPS.length - 1
          ? <Button onClick={next} variant="contained">Next</Button>
          : <Button variant="contained" color="success" onClick={onClose}>Submit</Button>}
      </DialogActions>
    </Dialog>
  );
}

// ─── Tab: Phone Numbers ───────────────────────────────────────────────────────

function PhoneNumbersTab() {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>Connected Numbers</Typography>
        <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setAddOpen(true)}>Add Number</Button>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {['Number', 'Display Name', 'Quality', 'Msg Limit', 'Opt-in Rate', 'Status', 'Actions'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {mockPhoneNumbers.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ fontFamily: 'monospace' }}>{r.number}</TableCell>
                <TableCell>{r.displayName}</TableCell>
                <TableCell><Chip label={r.quality} color={qualityColor(r.quality)} size="small" /></TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>{r.limit}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 48, height: 6, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
                      <Box sx={{ width: r.optIn, height: '100%', bgcolor: parseFloat(r.optIn) > 80 ? 'success.main' : 'warning.main', borderRadius: 1 }} />
                    </Box>
                    <Typography variant="caption" fontWeight={600}>{r.optIn}</Typography>
                  </Box>
                </TableCell>
                <TableCell><Chip label={r.status} color={statusColor(r.status)} size="small" /></TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="View Details"><IconButton size="small"><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Remove"><IconButton size="small" color="error"><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Phone Number</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Use the Embedded Signup flow below to connect a new WhatsApp Business phone number to your account.
          </Typography>
          <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
            <PhoneIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">Embedded Signup iframe placeholder</Typography>
            <Typography variant="caption" color="text.disabled">Meta Embedded Signup will load here</Typography>
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setAddOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Tab: Templates ───────────────────────────────────────────────────────────

function TemplatesTab() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [filterCat, setFilterCat] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filtered = mockTemplates.filter(
    (t) => (filterCat === 'ALL' || t.category === filterCat) && (filterStatus === 'ALL' || t.status === filterStatus),
  );

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} mb={2}>
        <Stack direction="row" spacing={1.5}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Category</InputLabel>
            <Select label="Category" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="MARKETING">Marketing</MenuItem>
              <MenuItem value="UTILITY">Utility</MenuItem>
              <MenuItem value="AUTHENTICATION">Authentication</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="APPROVED">Approved</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="REJECTED">Rejected</MenuItem>
            </Select>
          </FormControl>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setWizardOpen(true)}>Create Template</Button>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {['Name', 'Category', 'Language', 'Status', 'Buttons', 'Created', 'Actions'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0
              ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No templates match the current filters.</TableCell></TableRow>
              : filtered.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.name}</TableCell>
                  <TableCell><Chip label={r.category} color={catColor(r.category)} size="small" variant="outlined" /></TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{r.language}</TableCell>
                  <TableCell><Chip label={r.status} color={statusColor(r.status)} size="small" /></TableCell>
                  <TableCell align="center">{r.buttons}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{r.created}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Preview"><IconButton size="small"><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" color="error"><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TemplateWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </Box>
  );
}

// ─── Tab: Message Logs ────────────────────────────────────────────────────────

function MessageLogsTab() {
  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} mb={2}>
        <Stack direction="row" spacing={1.5}>
          <TextField size="small" label="From date" type="date" InputLabelProps={{ shrink: true }} defaultValue="2026-06-27" />
          <TextField size="small" label="To date" type="date" InputLabelProps={{ shrink: true }} defaultValue="2026-06-27" />
          <FormControl size="small" sx={{ minWidth: 110 }}><InputLabel>Status</InputLabel>
            <Select label="Status" defaultValue="ALL"><MenuItem value="ALL">All</MenuItem><MenuItem value="Delivered">Delivered</MenuItem><MenuItem value="Read">Read</MenuItem><MenuItem value="Failed">Failed</MenuItem></Select>
          </FormControl>
        </Stack>
        <Button variant="outlined" startIcon={<DownloadIcon />} size="small">Export CSV</Button>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {['Timestamp', 'From', 'To', 'Type', 'Status', 'Direction'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {mockMessageLogs.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>{r.timestamp}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.from}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.to}</TableCell>
                <TableCell><Chip label={r.type} size="small" variant="outlined" /></TableCell>
                <TableCell><Chip label={r.status} color={statusColor(r.status)} size="small" /></TableCell>
                <TableCell>
                  <Chip label={r.direction} size="small"
                    sx={{ bgcolor: r.direction === 'Inbound' ? '#e3f2fd' : '#e8f5e9', color: r.direction === 'Inbound' ? '#1565C0' : '#2E7D32', fontWeight: 600 }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Tab: Webhook Events ──────────────────────────────────────────────────────

function WebhookEventsTab() {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>Recent Webhook Events</Typography>
        <Chip label="● Live" color="success" size="small" sx={{ fontWeight: 700 }} />
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {['Timestamp', 'Event Type', 'From', 'Preview', 'Status', 'Actions'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {mockWebhookEvents.map((r) => (
              <TableRow key={r.id} hover sx={{ bgcolor: r.status === 'Failed' ? 'error.50' : 'inherit' }}>
                <TableCell sx={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>{r.timestamp}</TableCell>
                <TableCell><Chip label={r.type} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }} /></TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.from}</TableCell>
                <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'text.secondary' }}>{r.preview}</TableCell>
                <TableCell><Chip label={r.status} color={statusColor(r.status)} size="small" /></TableCell>
                <TableCell>
                  {r.status === 'Failed' && (
                    <Tooltip title="Retry"><IconButton size="small" color="warning"><RefreshIcon fontSize="small" /></IconButton></Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Tab: Media Library ───────────────────────────────────────────────────────

function MediaLibraryTab() {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>Media Library</Typography>
        <Button variant="contained" startIcon={<FileUploadIcon />} size="small">Upload Media</Button>
      </Stack>
      <Grid container spacing={2}>
        {mockMedia.map((m) => (
          <Grid item xs={12} sm={6} md={4} key={m.id}>
            <Card variant="outlined" sx={{ transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 3 } }}>
              <Box sx={{ height: 100, bgcolor: m.type === 'image' ? '#e3f0ff' : '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m.type === 'image'
                  ? <ImageIcon sx={{ fontSize: 44, color: '#1877F2', opacity: 0.5 }} />
                  : <FileIcon sx={{ fontSize: 44, color: '#9C27B0', opacity: 0.5 }} />}
              </Box>
              <CardContent sx={{ pt: 1.5, pb: '12px !important' }}>
                <Typography variant="body2" fontWeight={600} noWrap>{m.name}</Typography>
                <Stack direction="row" spacing={1} mt={0.5}>
                  <Typography variant="caption" color="text.secondary">{m.size}</Typography>
                  <Typography variant="caption" color="text.secondary">·</Typography>
                  <Typography variant="caption" color="text.secondary">{m.uploaded}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// ─── Tab: Opt-in Management ───────────────────────────────────────────────────

function OptInManagementTab() {
  return (
    <Box>
      <Box sx={{ bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200', borderRadius: 2, p: 2, mb: 2 }}>
        <Typography variant="body2" color="info.dark" fontWeight={600}>Compliance Notice</Typography>
        <Typography variant="caption" color="text.secondary">
          You must obtain explicit opt-in consent from customers before sending WhatsApp messages. Maintain records of opt-in date and channel as required by Meta's Business Policy and applicable data protection laws.
        </Typography>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>Contacts ({mockOptIns.length})</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<FileUploadIcon />}>Import List</Button>
          <Button variant="contained" size="small" color="success">Bulk Opt-In</Button>
          <Button variant="outlined" size="small" color="error">Bulk Opt-Out</Button>
        </Stack>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {['Contact', 'Name', 'Opt-In Status', 'Channel', 'Date', 'Actions'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {mockOptIns.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.contact}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>
                  <Chip label={r.optIn ? 'Opted In' : 'Opted Out'} color={r.optIn ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{r.channel}</TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{r.date}</TableCell>
                <TableCell>
                  <Button size="small" variant="outlined" color={r.optIn ? 'error' : 'success'} sx={{ fontSize: '0.72rem', py: 0.25 }}>
                    {r.optIn ? 'Opt Out' : 'Opt In'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = ['Phone Numbers', 'Templates', 'Message Logs', 'Webhook Events', 'Media Library', 'Opt-in Management'];

export default function WhatsAppManagementPage() {
  const [tab, setTab] = useState(0);

  const panels = [
    <PhoneNumbersTab />,
    <TemplatesTab />,
    <MessageLogsTab />,
    <WebhookEventsTab />,
    <MediaLibraryTab />,
    <OptInManagementTab />,
  ];

  return (
    <Box sx={{ pb: 6 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>WhatsApp Business</Typography>
        <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.2 }}>Management</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Unified control panel for phone numbers, templates, messages, webhooks, media, and opt-in compliance.
        </Typography>
      </Box>

      <Card variant="outlined">
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, fontSize: '0.8rem', fontWeight: 600 } }}
          >
            {TABS.map((t) => <Tab key={t} label={t} />)}
          </Tabs>
        </Box>
        <CardContent>
          {panels.map((panel, i) => (
            <TabPanel key={i} value={tab} index={i}>{panel}</TabPanel>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
}
