import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Accordion, AccordionDetails, AccordionSummary,
  Alert, Avatar, Box, Button, Card, CardContent, Checkbox, Chip,
  CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, Grid, InputAdornment, LinearProgress,
  List, ListItemButton, ListItemText, MenuItem, Paper, Stack, Switch,
  Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon          from '@mui/icons-material/Add';
import SendIcon         from '@mui/icons-material/Send';
import UploadFileIcon   from '@mui/icons-material/UploadFile';
import LinkIcon         from '@mui/icons-material/Link';
import LinkOffIcon      from '@mui/icons-material/LinkOff';
import QrCode2Icon      from '@mui/icons-material/QrCode2';
import PauseIcon        from '@mui/icons-material/Pause';
import PlayArrowIcon    from '@mui/icons-material/PlayArrow';
import StopIcon         from '@mui/icons-material/Stop';
import DownloadIcon     from '@mui/icons-material/Download';
import NavigateNextIcon     from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon   from '@mui/icons-material/NavigateBefore';
import ExpandMoreIcon   from '@mui/icons-material/ExpandMore';
import HistoryIcon      from '@mui/icons-material/History';
import GroupsIcon       from '@mui/icons-material/Groups';
import SearchIcon       from '@mui/icons-material/Search';
import SaveAltIcon      from '@mui/icons-material/SaveAlt';
import PageHeader    from '../components/PageHeader';
import PageSurface   from '../components/PageSurface';
import ResponsiveDialog from '../components/ResponsiveDialog';
import ResponsiveTable  from '../components/ResponsiveTable';
import whatsappService  from '../services/whatsappService';

// ── Tab definitions ───────────────────────────────────────────────────────────

const officialTabs = [
  ['inbox',       'Inbox'],
  ['rules',       'Auto Reply'],
  ['send',        'Quick Send'],
  ['invite',      'Invitation'],
  ['manual',      'Manual (wa.me)'],
  ['campaigns',   'Campaigns'],
  ['history',     'Blast History'],
  ['templates',   'Templates'],
  ['connections', 'Connections'],
  ['logs',        'Logs'],
];

const baileysTabs = [
  ['inbox',     'Inbox'],
  ['rules',     'Auto Reply'],
  ['send',      'Quick Send'],
  ['invite',    'Invitation'],
  ['manual',    'Manual (wa.me)'],
  ['campaigns', 'Campaigns'],
  ['history',   'Blast History'],
  ['logs',      'Logs'],
  ['groups',    'Group Members'],
  ['setup',     'Setup / QR'],
];

// ── Constants ─────────────────────────────────────────────────────────────────

const emptyInvitationForm = {
  blastTitle:   '',
  recipientMode: 'single', singleName: '', singleNumber: '',
  imageUrl: '',
  message: '',
  includeRsvp: true, rsvpYesLabel: "Yes, I'll attend ✅", rsvpNoLabel: "Sorry, can't make it ❌",
};

const emptyFontStyle = {
  x:          0.5,
  y:          0.88,
  fontFamily: 'serif',
  fontSize:   48,
  color:      '#ffffff',
  fontWeight: 'bold',
  textAlign:  'center',
  shadow:     true,
};

const recipientModeOptions = [
  { value: 'single', label: 'Single Number' },
  { value: 'csv',    label: 'CSV File'      },
  { value: 'excel',  label: 'Excel File'    },
];

const emptyRule = {
  name: '', matchType: 'CONTAINS', triggerText: '',
  replyType: 'TEXT', replyText: '', templateName: '',
  templateLanguage: 'en_US', isActive: true, priority: 100, stopAfterMatch: true,
};

const FONT_FAMILIES = [
  { value: 'serif',           label: 'Serif'           },
  { value: 'sans-serif',      label: 'Sans-serif'      },
  { value: 'cursive',         label: 'Cursive'         },
  { value: 'monospace',       label: 'Monospace'       },
  { value: 'Arial',           label: 'Arial'           },
  { value: 'Georgia',         label: 'Georgia'         },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Verdana',         label: 'Verdana'         },
  { value: 'Impact',          label: 'Impact'          },
];

const MAX_RECIPIENTS  = 999;
const DELAY_MIN_S     = 12;
const DELAY_MAX_S     = 20;
const MAX_PER_MINUTE  = 5;
const MAX_PER_HOUR    = 150;

// ── Helpers ───────────────────────────────────────────────────────────────────

const normalizePhone = (v) => {
  const d = String(v || '').replace(/[^\d]/g, '').trim();
  return d.length === 10 ? '91' + d : d;
};
const formatWhen       = (v) => v ? new Date(v).toLocaleString() : '-';
const conversationName = (item) => item?.contactName || item?.name || item?.phone || 'Unknown';
const sleep            = (ms) => new Promise(r => setTimeout(r, ms));
const randDelay        = () =>
  (Math.floor(Math.random() * (DELAY_MAX_S - DELAY_MIN_S + 1)) + DELAY_MIN_S) * 1000;

function parseRowsToRecipients(rows = []) {
  return rows.map(row => ({
    name: String(
      row.name || row.fullName || row.studentName || row.guestName || row.Name || ''
    ).trim() || 'Guest',
    mobile: normalizePhone(
      row.mobile || row.phone || row.number || row.whatsapp ||
      row.Mobile || row.Phone || row.Number || row.WhatsApp || ''
    ),
    source: 'FILE',
  })).filter(item => item.mobile);
}

function fmtSecs(s) {
  if (!s || s < 0) return '0s';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Canvas drawing helper ─────────────────────────────────────────────────────

function drawNameOnCanvas(canvas, imageEl, name, fontStyle) {
  if (!canvas || !imageEl) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(imageEl, 0, 0, W, H);

  if (!name) return;

  const {
    x          = 0.5,
    y          = 0.88,
    fontFamily = 'serif',
    fontSize   = 48,
    color      = '#ffffff',
    fontWeight = 'bold',
    textAlign  = 'center',
    shadow     = true,
  } = fontStyle;

  const scaledSize = Math.round(fontSize * (W / 600));

  ctx.font         = `${fontWeight} ${scaledSize}px ${fontFamily}`;
  ctx.fillStyle    = color;
  ctx.textAlign    = textAlign;
  ctx.textBaseline = 'middle';

  if (shadow) {
    ctx.shadowColor   = 'rgba(0,0,0,0.75)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur    = 6;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;
  }

  ctx.fillText(name, x * W, y * H);
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function CollectionSection({ title, subtitle, rows, onAdd, children }) {
  return (
    <Stack spacing={2}>
      <Card><CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between"
          spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={800}>{title}</Typography>
            <Typography color="text.secondary">{subtitle}</Typography>
          </Box>
          {onAdd && <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>Add</Button>}
        </Stack>
      </CardContent></Card>
      {children}
      <Card><CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <ResponsiveTable columns={rows.columns} rows={rows.data} />
      </CardContent></Card>
    </Stack>
  );
}

function MessageBubble({ message }) {
  const isOut = message.direction === 'OUTGOING';
  return (
    <Box sx={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start' }}>
      <Box sx={{
        maxWidth: '75%', px: 1.5, py: 1, borderRadius: 2,
        bgcolor: isOut ? '#dcf8c6' : '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,.13)',
      }}>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {message.bodyText || message.text || '—'}
        </Typography>
        <Typography variant="caption" color="text.secondary"
          sx={{ display: 'block', textAlign: 'right', mt: 0.25 }}>
          {formatWhen(message.createdAt)} · {message.status || ''}
          {message.source === 'AUTO_REPLY' ? ' · 🤖 auto' : ''}
        </Typography>
      </Box>
    </Box>
  );
}

function ProviderToggle({ useBaileys, onToggle, baileysStatus }) {
  const statusColor =
    baileysStatus === 'CONNECTED'  ? 'success' :
    baileysStatus === 'QR_PENDING' ? 'warning' : 'default';
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {useBaileys
              ? <QrCode2Icon sx={{ color: 'warning.main' }} />
              : <LinkIcon    sx={{ color: 'success.main' }} />}
            <Box>
              <Typography fontWeight={800}>
                {useBaileys ? '🐝 Baileys Mode' : '✅ Official Cloud API'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {useBaileys
                  ? 'Messages go through Baileys — scan QR in Setup tab to connect.'
                  : 'Messages sent via Meta Graph API. Configure env vars in backend.'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {useBaileys && (
              <Chip label={`Baileys: ${baileysStatus || 'UNKNOWN'}`} color={statusColor} size="small" />
            )}
            <Tooltip title={useBaileys ? 'Switch to Official API' : 'Switch to Baileys'}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="caption" color={!useBaileys ? 'primary' : 'text.secondary'} fontWeight={!useBaileys ? 800 : 400}>Official</Typography>
                <Switch checked={useBaileys} onChange={onToggle} color="warning" />
                <Typography variant="caption" color={useBaileys ? 'warning.main' : 'text.secondary'} fontWeight={useBaileys ? 800 : 400}>Baileys</Typography>
              </Stack>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Inbox panel ───────────────────────────────────────────────────────────────

function InboxPanel({ inbox, selectedKey, onSelect, conversationMessages,
  replyForm, setReplyForm, onSend, saving, isBaileys, templates }) {
  const accentBg       = isBaileys ? '#b37a00' : '#1976d2';
  const accentSelected = isBaileys ? '#fff8e1'  : '#e3f2fd';
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 4 }}>
        <PageSurface>
          <Card sx={{ overflow: 'hidden' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 2, py: 1.5, bgcolor: accentBg, color: '#fff' }}>
                <Typography fontWeight={800}>
                  {isBaileys ? '🐝 Baileys Inbox' : '📬 Official Inbox'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {inbox.length} conversations
                </Typography>
              </Box>
              <List sx={{ py: 0, maxHeight: { xs: 'unset', lg: '68vh' }, overflow: 'auto' }}>
                {inbox.length === 0 && (
                  <Box sx={{ p: 2 }}>
                    <Typography color="text.secondary" variant="body2">
                      {isBaileys
                        ? 'No conversations yet. Connect via QR and receive a message first.'
                        : 'No conversations yet.'}
                    </Typography>
                  </Box>
                )}
                {inbox.map(item => (
                  <ListItemButton
                    key={item.conversationKey}
                    selected={item.conversationKey === selectedKey}
                    onClick={() => onSelect(item.conversationKey)}
                    sx={{
                      alignItems: 'flex-start',
                      borderBottom: '1px solid', borderColor: 'divider',
                      '&.Mui-selected': { bgcolor: accentSelected },
                    }}>
                    <Avatar sx={{ bgcolor: isBaileys ? 'warning.main' : 'primary.main', mr: 1.5 }}>
                      {conversationName(item).slice(0, 1)}
                    </Avatar>
                    <ListItemText
                      primary={conversationName(item)}
                      primaryTypographyProps={{ fontWeight: 800 }}
                      secondary={`${item.phone || ''}${item.lastMessage ? ` • ${item.lastMessage}` : ''}`}
                    />
                    <Stack alignItems="flex-end" spacing={0.75}>
                      <Typography variant="caption" color="text.secondary">
                        {formatWhen(item.lastMessageAt)}
                      </Typography>
                      {item.unreadCount > 0 && (
                        <Chip label={item.unreadCount} size="small"
                          color={isBaileys ? 'warning' : 'primary'} />
                      )}
                    </Stack>
                  </ListItemButton>
                ))}
              </List>
            </CardContent>
          </Card>
        </PageSurface>
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        <PageSurface>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography fontWeight={800}>
                  {selectedKey
                    ? conversationName(inbox.find(i => i.conversationKey === selectedKey)) || selectedKey
                    : 'Select a chat'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedKey || 'Choose a conversation from the left list.'}
                </Typography>
              </Box>
              <Box sx={{
                p: 2, minHeight: 360,
                maxHeight: { xs: 'unset', lg: '52vh' }, overflow: 'auto',
                bgcolor: isBaileys ? '#fef9e7' : '#efeae2',
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
                backgroundSize: '18px 18px',
              }}>
                <Stack spacing={1.2}>
                  {conversationMessages.length
                    ? conversationMessages.map(msg =>
                        <MessageBubble key={msg._id || msg.baileysMessageId || Math.random()} message={msg} />)
                    : <Typography color="text.secondary">No messages yet.</Typography>}
                </Stack>
              </Box>
              <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: '#f0f2f5' }}>
                {!isBaileys && (
                  <TextField select label="Template" value={replyForm.templateName || ''} sx={{ mb: 1.5 }}
                    onChange={e => setReplyForm(p => ({ ...p, templateName: e.target.value }))}>
                    <MenuItem value="">No Template</MenuItem>
                    {(templates || []).map(item => (
                      <MenuItem key={item._id} value={item.name}>{item.displayName || item.name}</MenuItem>
                    ))}
                  </TextField>
                )}
                <TextField fullWidth label="Reply message" multiline minRows={2} value={replyForm.text}
                  onChange={e => setReplyForm(p => ({ ...p, text: e.target.value }))} />
                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                  <Button variant="contained" color={isBaileys ? 'warning' : 'primary'}
                    startIcon={<SendIcon />}
                    disabled={saving || !selectedKey || !replyForm.text.trim()} onClick={onSend}>
                    {isBaileys ? 'Send via Baileys' : 'Send Reply'}
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </PageSurface>
      </Grid>
    </Grid>
  );
}

// ── Quick Send ────────────────────────────────────────────────────────────────

function QuickSendPanel({ onSend, saving, isBaileys, templates }) {
  const [form, setForm] = useState({ to: '', contactName: '', text: '', templateName: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <PageSurface>
      <Card><CardContent>
        <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
          {isBaileys ? '🐝 Baileys Quick Send' : '📤 Quick Send'}
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField label="To (phone number)" value={form.to}
              onChange={e => set('to', e.target.value)}
              helperText="10-digit or with country code e.g. 919876543210" />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField label="Contact Name (optional)" value={form.contactName}
              onChange={e => set('contactName', e.target.value)} />
          </Grid>
          {!isBaileys && templates?.length > 0 && (
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField select label="Template" value={form.templateName}
                onChange={e => set('templateName', e.target.value)}>
                <MenuItem value="">No Template</MenuItem>
                {templates.map(t =>
                  <MenuItem key={t._id} value={t.name}>{t.displayName || t.name}</MenuItem>)}
              </TextField>
            </Grid>
          )}
          <Grid size={{ xs: 12 }}>
            <TextField label="Message" multiline minRows={3} value={form.text}
              onChange={e => set('text', e.target.value)} />
          </Grid>
        </Grid>
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button variant="contained" color={isBaileys ? 'warning' : 'primary'}
            startIcon={<SendIcon />}
            disabled={saving || !form.to || !form.text.trim()}
            onClick={() => {
              onSend(form);
              setForm({ to: '', contactName: '', text: '', templateName: '' });
            }}>
            Send
          </Button>
        </Stack>
      </CardContent></Card>
    </PageSurface>
  );
}

// ── Auto Reply panel ──────────────────────────────────────────────────────────

function AutoReplyPanel({ rules, onAdd, onEdit, isBaileys }) {
  const ruleRows = {
    columns: [
      { key: 'name',    label: 'Rule'    },
      { key: 'trigger', label: 'Trigger' },
      { key: 'reply',   label: 'Reply'   },
      { key: 'status',  label: 'Status'  },
      { key: 'action',  label: 'Action'  },
    ],
    data: rules.map(item => ({
      title:   item.name || 'Rule',
      name:    item.name || '-',
      trigger: `${item.matchType || '-'} • ${item.triggerText || 'ALL'}`,
      reply:   item.replyType === 'TEMPLATE' ? item.templateName || '-' : item.replyText || '-',
      status:  () => <Chip label={item.isActive ? 'Active' : 'Inactive'}
                      color={item.isActive ? 'success' : 'default'} size="small" />,
      action:  () => <Button size="small" variant="contained"
                      color={isBaileys ? 'warning' : 'primary'}
                      onClick={() => onEdit(item)}>Edit</Button>,
    })),
  };
  return (
    <CollectionSection
      title={isBaileys ? '🐝 Baileys Auto Reply Rules' : 'Auto Reply Rules'}
      subtitle={isBaileys
        ? 'Rules applied to incoming Baileys messages automatically.'
        : 'Rules trigger after customer message is stored by webhook.'}
      rows={ruleRows}
      onAdd={onAdd}
    >
      {!isBaileys && (
        <Card><CardContent>
          <Typography fontWeight={700}>Webhook setup</Typography>
          <Typography variant="body2" color="text.secondary">
            Meta webhook URL: <strong>/api/whatsapp/webhook</strong>.
          </Typography>
        </CardContent></Card>
      )}
      {isBaileys && (
        <Card><CardContent>
          <Typography fontWeight={700}>How Baileys auto-reply works</Typography>
          <Typography variant="body2" color="text.secondary">
            Rules are evaluated on every incoming Baileys message. Matching rules send a text
            reply automatically and log it with source AUTO_REPLY.
          </Typography>
        </CardContent></Card>
      )}
    </CollectionSection>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Invitation Panel ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function InvitationPanel({
  isBaileys,
  invitationForm, setInvitationForm,
  selectedRecipients, setSelectedRecipients,
  fontStyle, setFontStyle,
  onUploadImage, uploadingImage,
  sendServiceFn,
  fileName, setFileName,
}) {
  // ── Canvas / drag state ─────────────────────────────────────────────────────
  const canvasRef      = useRef(null);
  const imageElRef     = useRef(null);
  const isDraggingRef  = useRef(false);
  const [previewIdx,   setPreviewIdx]   = useState(0);
  const [imageLoaded,  setImageLoaded]  = useState(false);

  // ── Queue state ─────────────────────────────────────────────────────────────
  const [queue,       setQueue]       = useState([]);
  const [queueActive, setQueueActive] = useState(false);
  const [queuePaused, setQueuePaused] = useState(false);
  const [queueDone,   setQueueDone]   = useState(false);
  const [queueIdx,    setQueueIdx]    = useState(0);
  const pauseRef  = useRef(false);
  const cancelRef = useRef(false);

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const sendTimestamps   = useRef([]);
  const [cooldownEnds,   setCooldownEnds]   = useState(null);
  const [cooldownSecs,   setCooldownSecs]   = useState(0);
  const [cooldownReason, setCooldownReason] = useState('');

  useEffect(() => {
    if (!cooldownEnds) { setCooldownSecs(0); return; }
    const tick = () => {
      const s = Math.max(0, Math.round((cooldownEnds - Date.now()) / 1000));
      setCooldownSecs(s);
      if (s === 0) setCooldownEnds(null);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [cooldownEnds]);

  // ── Campaign saving ─────────────────────────────────────────────────────────
  const blastIdRef      = useRef(null);
  const blastResultsRef = useRef([]);

  // ── Load Previous dialog ────────────────────────────────────────────────────
  const [loadPrevOpen, setLoadPrevOpen] = useState(false);
  const [prevBlasts,   setPrevBlasts]   = useState([]);
  const [loadingPrev,  setLoadingPrev]  = useState(false);

  // ── Load image + set canvas aspect ratio ────────────────────────────────────
  useEffect(() => {
    const url = invitationForm.imageUrl;
    if (!url) { setImageLoaded(false); imageElRef.current = null; return; }
    setImageLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => { imageElRef.current = img; setImageLoaded(true); };
    img.onerror = () => { imageElRef.current = null; setImageLoaded(false); };
    img.src = url;
  }, [invitationForm.imageUrl]);

  // Update canvas dimensions once image is loaded
  useEffect(() => {
    if (imageLoaded && canvasRef.current && imageElRef.current?.naturalWidth > 0) {
      canvasRef.current.width  = 600;
      canvasRef.current.height = Math.round(600 * imageElRef.current.naturalHeight / imageElRef.current.naturalWidth);
    }
  }, [imageLoaded]);

  // ── Redraw canvas ───────────────────────────────────────────────────────────
  const redraw = useCallback((overrideName) => {
    if (!imageLoaded || !canvasRef.current || !imageElRef.current) return;
    const checked = getCheckedRecipients();
    const name = overrideName !== undefined ? overrideName
      : invitationForm.recipientMode === 'single'
        ? invitationForm.singleName || 'Guest'
        : checked[previewIdx]?.name || '';
    drawNameOnCanvas(canvasRef.current, imageElRef.current, name, fontStyle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageLoaded, previewIdx, fontStyle, invitationForm.singleName,
      invitationForm.recipientMode, selectedRecipients]);

  useEffect(() => { redraw(); }, [redraw]);

  // ── Drag handlers — mouse + touch ───────────────────────────────────────────
  const getCanvasFraction = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect    = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top)  / rect.height)),
    };
  };

  const onDragStart = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const pos = getCanvasFraction(e);
    if (pos) setFontStyle(p => ({ ...p, x: pos.x, y: pos.y }));
  };
  const onDragMove = (e) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const pos = getCanvasFraction(e);
    if (pos) setFontStyle(p => ({ ...p, x: pos.x, y: pos.y }));
  };
  const onDragEnd = () => { isDraggingRef.current = false; };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getCheckedRecipients = () =>
    invitationForm.recipientMode === 'single'
      ? [{ name: invitationForm.singleName || 'Guest', mobile: invitationForm.singleNumber, source: 'MANUAL' }]
      : selectedRecipients.filter(r => r.checked !== false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const buffer   = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const rows     = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    setSelectedRecipients(parseRowsToRecipients(rows).map(r => ({ ...r, checked: true })));
    setPreviewIdx(0);
  };

  const handleDownloadPreview = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `invite_preview_${previewIdx + 1}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  // ── Generate personalised image URL ─────────────────────────────────────────
  const buildPersonalisedImageUrl = (recipientName) => new Promise((resolve) => {
    if (!imageElRef.current) { resolve(invFormRef.current.imageUrl); return; }
    const off = document.createElement('canvas');
    off.width  = 1200;
    off.height = Math.round(1200 * (imageElRef.current.naturalHeight / imageElRef.current.naturalWidth)) || 800;
    drawNameOnCanvas(off, imageElRef.current, recipientName, fontStyleRef.current);
    off.toBlob(async (blob) => {
      if (!blob) { resolve(invFormRef.current.imageUrl); return; }
      try {
        const { default: api } = await import('../api');
        const fd = new FormData();
        fd.append('file', blob, `invite_${Date.now()}.png`);
        fd.append('folder', 'bk_award_invites');
        const res = await api.post('/uploads/public', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        resolve(res?.data?.url || invFormRef.current.imageUrl);
      } catch (_) {
        resolve(invFormRef.current.imageUrl);
      }
    }, 'image/png');
  });

  // ── Load Previous ───────────────────────────────────────────────────────────
  const openLoadPrev = async () => {
    setLoadPrevOpen(true);
    setLoadingPrev(true);
    try {
      const { default: api } = await import('../api');
      const res = await api.get('/blasts');
      setPrevBlasts(Array.isArray(res.data) ? res.data : []);
    } catch (_) { setPrevBlasts([]); }
    finally { setLoadingPrev(false); }
  };

  const restorePrevBlast = (blast) => {
    setInvitationForm(p => ({
      ...p,
      blastTitle:   blast.title       || p.blastTitle,
      imageUrl:     blast.imageUrl    || p.imageUrl,
      message:      blast.message     !== undefined ? blast.message : p.message,
      includeRsvp:  blast.includeRsvp ?? p.includeRsvp,
      rsvpYesLabel: blast.rsvpYesLabel || p.rsvpYesLabel,
      rsvpNoLabel:  blast.rsvpNoLabel  || p.rsvpNoLabel,
    }));
    if (blast.fontStyle && Object.keys(blast.fontStyle).length > 0)
      setFontStyle(p => ({ ...p, ...blast.fontStyle }));
    setLoadPrevOpen(false);
  };

  const checkedRecipients = getCheckedRecipients();
  const totalCount        = checkedRecipients.length;
  const overLimit         = totalCount > MAX_RECIPIENTS;

  // ── Queue controls ──────────────────────────────────────────────────────────
  const startQueue = () => {
    const recipients = getCheckedRecipients().slice(0, MAX_RECIPIENTS);
    if (!recipients.length) return;
    pauseRef.current  = false;
    cancelRef.current = false;
    blastIdRef.current     = null;
    blastResultsRef.current = [];
    setQueue(recipients.map(r => ({ ...r, status: 'pending', error: '' })));
    setQueueIdx(0);
    setQueueActive(true);
    setQueuePaused(false);
    setQueueDone(false);
    setCooldownEnds(null);
  };

  const pauseQueue  = () => { pauseRef.current = true;  setQueuePaused(true);  };
  const resumeQueue = () => { pauseRef.current = false; setQueuePaused(false); };
  const cancelQueue = () => { cancelRef.current = true; pauseRef.current = false; };
  const resetQueue  = () => {
    setQueue([]); setQueueActive(false); setQueuePaused(false);
    setQueueDone(false); setQueueIdx(0); setCooldownEnds(null);
    pauseRef.current = false; cancelRef.current = false;
  };

  // Stable refs for async loop
  const invFormRef   = useRef(invitationForm);
  const fontStyleRef = useRef(fontStyle);
  useEffect(() => { invFormRef.current   = invitationForm; }, [invitationForm]);
  useEffect(() => { fontStyleRef.current = fontStyle;      }, [fontStyle]);

  // ── Queue run loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!queueActive || queueDone) return;

    const run = async () => {
      const recipients = queue;

      // Save blast campaign before sending
      try {
        const { default: api } = await import('../api');
        const blastRes = await api.post('/blasts', {
          title:           invFormRef.current.blastTitle || 'Untitled Blast',
          message:         invFormRef.current.message,
          imageUrl:        invFormRef.current.imageUrl,
          includeRsvp:     invFormRef.current.includeRsvp,
          rsvpYesLabel:    invFormRef.current.rsvpYesLabel,
          rsvpNoLabel:     invFormRef.current.rsvpNoLabel,
          fontStyle:       fontStyleRef.current,
          status:          'SENDING',
          totalRecipients: recipients.length,
          recipients:      recipients.map(r => ({ name: r.name, mobile: r.mobile, source: r.source, status: 'PENDING' })),
        });
        blastIdRef.current = blastRes.data._id;
      } catch (err) {
        console.warn('[blast] Failed to save campaign:', err.message);
      }

      let i = queueIdx;

      while (i < recipients.length) {
        if (cancelRef.current) break;
        while (pauseRef.current) {
          await sleep(500);
          if (cancelRef.current) break;
        }
        if (cancelRef.current) break;

        // ── Rate limiting ─────────────────────────────────────────────────────
        const now          = Date.now();
        const oneMinuteAgo = now - 60_000;
        const oneHourAgo   = now - 3_600_000;
        sendTimestamps.current = sendTimestamps.current.filter(t => t > oneHourAgo);
        const inLastMinute = sendTimestamps.current.filter(t => t > oneMinuteAgo).length;
        const inLastHour   = sendTimestamps.current.length;

        let waitMs = 0;
        let reason = '';
        if (inLastMinute >= MAX_PER_MINUTE) {
          const oldest = [...sendTimestamps.current].filter(t => t > oneMinuteAgo).sort((a, b) => a - b)[0];
          waitMs = (oldest + 61_000) - Date.now();
          reason = `per-minute limit (${MAX_PER_MINUTE}/min)`;
        } else if (inLastHour >= MAX_PER_HOUR) {
          const oldest = [...sendTimestamps.current].sort((a, b) => a - b)[0];
          waitMs = (oldest + 3_601_000) - Date.now();
          reason = `per-hour limit (${MAX_PER_HOUR}/hr)`;
        }

        if (waitMs > 0) {
          setCooldownReason(reason);
          setCooldownEnds(Date.now() + waitMs);
          const end = Date.now() + waitMs;
          while (Date.now() < end) {
            await sleep(500);
            if (cancelRef.current) break;
          }
          setCooldownEnds(null);
          setCooldownReason('');
        }
        if (cancelRef.current) break;

        // Capture i as a constant so closures below are not affected by i++
        const currentIdx = i;

        setQueue(prev => prev.map((item, idx) => idx === currentIdx ? { ...item, status: 'sending' } : item));
        setQueueIdx(currentIdx);

        let sendStatus = 'FAILED';
        let sendError  = '';
        try {
          const personalisedUrl = await buildPersonalisedImageUrl(recipients[currentIdx].name);
          // Replace {name} placeholder in message text
          const personalisedMsg = (invFormRef.current.message || '')
            .replace(/\{name\}/gi, recipients[currentIdx].name || 'Guest');

          await sendServiceFn({
            ...invFormRef.current,
            message:      personalisedMsg,
            imageUrl:     personalisedUrl,
            recipients:   [{ name: recipients[currentIdx].name, mobile: recipients[currentIdx].mobile, source: recipients[currentIdx].source }],
            textPosition: fontStyleRef.current,
          });
          setQueue(prev => prev.map((item, idx) => idx === currentIdx ? { ...item, status: 'delivered' } : item));
          sendTimestamps.current.push(Date.now());
          sendStatus = 'SENT';
        } catch (err) {
          sendError = err?.response?.data?.message || err.message || 'Failed';
          setQueue(prev => prev.map((item, idx) =>
            idx === currentIdx ? { ...item, status: 'failed', error: sendError } : item));
        }

        blastResultsRef.current.push({
          name:   recipients[currentIdx].name,
          mobile: recipients[currentIdx].mobile,
          source: recipients[currentIdx].source || 'CUSTOM',
          status: sendStatus,
          error:  sendError,
          sentAt: new Date().toISOString(),
        });

        i++;
        if (i < recipients.length && !cancelRef.current) await sleep(randDelay());
      }

      // Update blast campaign with final results
      if (blastIdRef.current) {
        try {
          const { default: api } = await import('../api');
          await api.patch(`/blasts/${blastIdRef.current}`, {
            status:      cancelRef.current ? 'CANCELLED' : 'COMPLETED',
            sentCount:   blastResultsRef.current.filter(r => r.status === 'SENT').length,
            failedCount: blastResultsRef.current.filter(r => r.status === 'FAILED').length,
            recipients:  blastResultsRef.current,
          });
        } catch (err) {
          console.warn('[blast] Failed to update campaign:', err.message);
        }
      }

      setQueueActive(false);
      setQueueDone(true);
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueActive]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const delivered = queue.filter(r => r.status === 'delivered').length;
  const failed    = queue.filter(r => r.status === 'failed').length;
  const pending   = queue.filter(r => r.status === 'pending').length;
  const progress  = queue.length ? Math.round(((delivered + failed) / queue.length) * 100) : 0;
  const etaSecs   = Math.round(pending * ((DELAY_MIN_S + DELAY_MAX_S) / 2));

  const accentColor = isBaileys ? 'warning' : 'primary';

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <PageSurface>
      <Stack spacing={2}>

        {/* Header */}
        <Card><CardContent>
          <Typography variant="h6" fontWeight={800}>
            {isBaileys ? '🐝 Baileys Invitation Blast' : '📨 Invitation Blast'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Each recipient gets a personalised image with their name. Max {MAX_RECIPIENTS} per blast ·
            {' '}{DELAY_MIN_S}–{DELAY_MAX_S}s gap · max {MAX_PER_MINUTE}/min · {MAX_PER_HOUR}/hr.
          </Typography>
        </CardContent></Card>

        {/* Blast title + Load Previous */}
        <Card><CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField
              fullWidth size="small"
              label="Blast Title"
              value={invitationForm.blastTitle || ''}
              onChange={e => setInvitationForm(p => ({ ...p, blastTitle: e.target.value }))}
              placeholder="e.g. Annual Awards Invitation 2025"
            />
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={openLoadPrev}
              sx={{ whiteSpace: 'nowrap', minWidth: 160 }}
            >
              Load Previous
            </Button>
          </Stack>
        </CardContent></Card>

        {/* Accordion 1 — Image & Name Preview */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700}>🖼 Image & Name Preview</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField fullWidth label="Image URL" value={invitationForm.imageUrl}
                  onChange={e => setInvitationForm(p => ({ ...p, imageUrl: e.target.value }))}
                  helperText="Paste a public image URL, or upload below." />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Button component="label" variant="outlined" fullWidth sx={{ height: 56 }}
                  startIcon={uploadingImage ? <CircularProgress size={16} /> : <UploadFileIcon />}
                  disabled={uploadingImage}>
                  {uploadingImage ? 'Uploading…' : 'Upload Image'}
                  <input hidden accept="image/*" type="file" onChange={onUploadImage} />
                </Button>
              </Grid>

              {invitationForm.imageUrl && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    ✋ Drag or tap anywhere on the image to reposition the name text
                  </Typography>

                  <Box
                    sx={{
                      border: '2px solid', borderColor: 'divider', borderRadius: 2,
                      overflow: 'hidden', bgcolor: '#111',
                      display: 'inline-block', maxWidth: '100%',
                      cursor: 'crosshair', userSelect: 'none', touchAction: 'none',
                    }}
                    onMouseDown={onDragStart} onMouseMove={onDragMove}
                    onMouseUp={onDragEnd}     onMouseLeave={onDragEnd}
                    onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}
                  >
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={400}
                      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                    />
                  </Box>

                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Position: {Math.round(fontStyle.x * 100)}% left · {Math.round(fontStyle.y * 100)}% top
                  </Typography>

                  {invitationForm.recipientMode !== 'single' && checkedRecipients.length > 0 && (
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                      <Button size="small" variant="outlined" startIcon={<NavigateBeforeIcon />}
                        disabled={previewIdx === 0}
                        onClick={() => setPreviewIdx(i => Math.max(0, i - 1))}>Prev</Button>
                      <Typography variant="body2" color="text.secondary">
                        {previewIdx + 1} / {checkedRecipients.length} — <strong>{checkedRecipients[previewIdx]?.name}</strong>
                      </Typography>
                      <Button size="small" variant="outlined" endIcon={<NavigateNextIcon />}
                        disabled={previewIdx >= checkedRecipients.length - 1}
                        onClick={() => setPreviewIdx(i => Math.min(checkedRecipients.length - 1, i + 1))}>Next</Button>
                      <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
                        onClick={handleDownloadPreview}>Download</Button>
                    </Stack>
                  )}
                  {invitationForm.recipientMode === 'single' && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
                        onClick={handleDownloadPreview}>Download Preview</Button>
                    </Stack>
                  )}
                  {!imageLoaded && invitationForm.imageUrl && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                      ⚠️ Image could not be loaded. Make sure the URL is publicly accessible (CORS-friendly).
                    </Typography>
                  )}
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Accordion 2 — Name Text Style */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700}>✏️ Name Text Style</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField fullWidth select label="Font Family" value={fontStyle.fontFamily}
                  onChange={e => setFontStyle(p => ({ ...p, fontFamily: e.target.value }))}>
                  {FONT_FAMILIES.map(f => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <TextField fullWidth type="number" label="Font Size (px)" value={fontStyle.fontSize}
                  inputProps={{ min: 10, max: 200 }}
                  onChange={e => setFontStyle(p => ({ ...p, fontSize: Number(e.target.value) }))} />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Font Color</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <input
                      type="color"
                      value={fontStyle.color}
                      onChange={e => setFontStyle(p => ({ ...p, color: e.target.value }))}
                      style={{ width: 48, height: 40, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                    />
                    <Typography variant="body2">{fontStyle.color}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button size="small"
                    variant={fontStyle.fontWeight === 'bold' ? 'contained' : 'outlined'} color={accentColor}
                    onClick={() => setFontStyle(p => ({ ...p, fontWeight: p.fontWeight === 'bold' ? 'normal' : 'bold' }))}>
                    <strong>B</strong>
                  </Button>
                  {['left', 'center', 'right'].map(a => (
                    <Button key={a} size="small"
                      variant={fontStyle.textAlign === a ? 'contained' : 'outlined'} color={accentColor}
                      onClick={() => setFontStyle(p => ({ ...p, textAlign: a }))}>
                      {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
                    </Button>
                  ))}
                  <Tooltip title="Text shadow improves readability on busy backgrounds">
                    <Button size="small"
                      variant={fontStyle.shadow ? 'contained' : 'outlined'} color={accentColor}
                      onClick={() => setFontStyle(p => ({ ...p, shadow: !p.shadow }))}>Shadow</Button>
                  </Tooltip>
                  <Tooltip title="Reset text position to default (bottom-centre)">
                    <Button size="small" variant="outlined"
                      onClick={() => setFontStyle(p => ({ ...p, x: 0.5, y: 0.88 }))}>Reset Pos</Button>
                  </Tooltip>
                </Stack>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Accordion 3 — Message */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700}>💬 Message</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Message" multiline minRows={3}
                  value={invitationForm.message}
                  onChange={e => setInvitationForm(p => ({ ...p, message: e.target.value }))}
                  helperText="Use {name} as a placeholder — replaced with each recipient's name at send time." />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={<Switch checked={!!invitationForm.includeRsvp}
                    onChange={e => setInvitationForm(p => ({ ...p, includeRsvp: e.target.checked }))} color="success" />}
                  label={<Typography variant="body2" fontWeight={600}>Request RSVP confirmation</Typography>}
                />
                {invitationForm.includeRsvp && (
                  <Typography variant="caption" color="text.secondary"
                    sx={{ display: 'block', ml: 4, mb: 1, whiteSpace: 'pre-line' }}>
                    {"A follow-up text is sent after the image:\n\"Please confirm your attendance:\n✅ Reply [Yes] · ❌ Reply [No]\""}
                  </Typography>
                )}
              </Grid>
              {invitationForm.includeRsvp && (
                <>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField fullWidth size="small" label="Yes Label" value={invitationForm.rsvpYesLabel}
                      onChange={e => setInvitationForm(p => ({ ...p, rsvpYesLabel: e.target.value }))} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField fullWidth size="small" label="No Label" value={invitationForm.rsvpNoLabel}
                      onChange={e => setInvitationForm(p => ({ ...p, rsvpNoLabel: e.target.value }))} />
                  </Grid>
                </>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Accordion 4 — Recipients */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700}>
              👥 Recipients{totalCount > 0 ? ` (${totalCount} selected)` : ''}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth select label="Recipient Source" value={invitationForm.recipientMode}
                  onChange={e => { setInvitationForm(p => ({ ...p, recipientMode: e.target.value })); setPreviewIdx(0); }}>
                  {recipientModeOptions.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </TextField>
              </Grid>

              {invitationForm.recipientMode === 'single' && (
                <>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField fullWidth label="Name" value={invitationForm.singleName}
                      onChange={e => setInvitationForm(p => ({ ...p, singleName: e.target.value }))} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField fullWidth label="Phone" value={invitationForm.singleNumber}
                      onChange={e => setInvitationForm(p => ({ ...p, singleNumber: e.target.value }))}
                      helperText="10-digit auto-prefixed with 91" />
                  </Grid>
                </>
              )}

              {['csv', 'excel'].includes(invitationForm.recipientMode) && (
                <Grid size={{ xs: 12 }}>
                  <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
                    <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                      Upload {invitationForm.recipientMode.toUpperCase()}
                      <input hidden type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
                    </Button>
                    {fileName && (
                      <Typography variant="body2" color="text.secondary">
                        📄 {fileName} — <strong>{selectedRecipients.length}</strong> recipients found
                      </Typography>
                    )}
                  </Stack>
                </Grid>
              )}
            </Grid>

            {selectedRecipients.length > 0 && invitationForm.recipientMode !== 'single' && (
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography fontWeight={700}>
                    {checkedRecipients.length} of {selectedRecipients.length} selected
                    {overLimit && (
                      <Chip label={`Max ${MAX_RECIPIENTS} — first ${MAX_RECIPIENTS} will be used`}
                        color="warning" size="small" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small"
                      onClick={() => setSelectedRecipients(prev => prev.map(r => ({ ...r, checked: true })))}>
                      All
                    </Button>
                    <Button size="small"
                      onClick={() => setSelectedRecipients(prev => prev.map(r => ({ ...r, checked: false })))}>
                      None
                    </Button>
                  </Stack>
                </Stack>
                <Box sx={{ maxHeight: 220, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                  <Grid container>
                    {selectedRecipients.map((r, idx) => (
                      <Grid key={idx} size={{ xs: 12, md: 6, xl: 4 }}>
                        <FormControlLabel
                          label={
                            <Typography variant="body2">
                              <strong>{r.name}</strong> — {r.mobile}
                            </Typography>
                          }
                          control={
                            <Checkbox size="small" checked={r.checked !== false}
                              onChange={() => setSelectedRecipients(prev =>
                                prev.map((x, i) => i === idx ? { ...x, checked: x.checked === false } : x)
                              )} />
                          }
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Cooldown banner */}
        {cooldownEnds && (
          <Alert severity="warning">
            <Stack spacing={1}>
              <Typography variant="body2">
                ⏱ WhatsApp rate limit reached ({cooldownReason}) — cooling down: <strong>{cooldownSecs}s</strong> remaining.
              </Typography>
              <Box>
                <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />} onClick={cancelQueue}>
                  Cancel Queue
                </Button>
              </Box>
            </Stack>
          </Alert>
        )}

        {/* Queue status */}
        {queue.length > 0 && (
          <Card><CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography fontWeight={700}>
                📬 Queue — {delivered} delivered · {failed} failed · {pending} pending
              </Typography>
              <Stack direction="row" spacing={1}>
                {queueActive && !queuePaused && !cooldownEnds && (
                  <Button size="small" variant="outlined" color="warning" startIcon={<PauseIcon />}
                    onClick={pauseQueue}>Pause</Button>
                )}
                {queueActive && queuePaused && (
                  <Button size="small" variant="outlined" color="success" startIcon={<PlayArrowIcon />}
                    onClick={resumeQueue}>Resume</Button>
                )}
                {queueActive && (
                  <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />}
                    onClick={cancelQueue}>Cancel</Button>
                )}
                {queueDone && (
                  <Button size="small" variant="outlined" onClick={resetQueue}>Clear Queue</Button>
                )}
              </Stack>
            </Stack>

            <Box sx={{ mb: 1 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">{progress}% complete</Typography>
                {queueActive && !queueDone && (
                  <Typography variant="caption" color="text.secondary">
                    ETA ~{fmtSecs(etaSecs)} · {DELAY_MIN_S}–{DELAY_MAX_S}s per message
                  </Typography>
                )}
                {queueDone && (
                  <Typography variant="caption" color={failed > 0 ? 'error' : 'success.main'} fontWeight={700}>
                    {cancelRef.current ? 'Cancelled' : 'Done'} — {delivered} sent, {failed} failed
                  </Typography>
                )}
              </Stack>
              <LinearProgress variant="determinate" value={progress}
                color={failed > 0 ? 'error' : queueDone ? 'success' : accentColor}
                sx={{ mt: 0.5, height: 8, borderRadius: 4 }} />
            </Box>

            <Box sx={{ maxHeight: 280, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              {queue.map((item, idx) => (
                <Stack key={idx} direction="row" alignItems="center" spacing={1.5}
                  sx={{
                    px: 1.5, py: 0.75,
                    borderBottom: idx < queue.length - 1 ? '1px solid' : 'none', borderColor: 'divider',
                    bgcolor: item.status === 'sending' ? (isBaileys ? '#fffde7' : '#e3f2fd') : 'transparent',
                  }}>
                  <Typography variant="body2" sx={{ minWidth: 24, color: 'text.secondary' }}>{idx + 1}</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={item.status === 'sending' ? 700 : 400}>{item.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.mobile}</Typography>
                  </Box>
                  <Chip size="small"
                    label={
                      item.status === 'pending'   ? '⏳ Pending'   :
                      item.status === 'sending'   ? '🔄 Sending'   :
                      item.status === 'delivered' ? '✅ Delivered' : '❌ Failed'
                    }
                    color={
                      item.status === 'delivered' ? 'success' :
                      item.status === 'failed'    ? 'error'   :
                      item.status === 'sending'   ? (isBaileys ? 'warning' : 'primary') : 'default'
                    }
                  />
                  {item.status === 'failed' && item.error && (
                    <Tooltip title={item.error}>
                      <Typography variant="caption" color="error"
                        sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.error}
                      </Typography>
                    </Tooltip>
                  )}
                </Stack>
              ))}
            </Box>
          </CardContent></Card>
        )}

        {/* Start Blast button */}
        {!queueActive && !queueDone && (
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography color="text.secondary" variant="body2">
              {totalCount} recipient{totalCount !== 1 ? 's' : ''} selected
              {overLimit && ` — only first ${MAX_RECIPIENTS} will be sent`}
            </Typography>
            <Button
              variant="contained" color={accentColor} size="large" startIcon={<SendIcon />}
              disabled={totalCount === 0 || (!invitationForm.imageUrl && !invitationForm.message.trim())}
              onClick={startQueue}>
              Start Blast {totalCount > 0 ? `(${Math.min(totalCount, MAX_RECIPIENTS)})` : ''}
            </Button>
          </Stack>
        )}

        {queueDone && (
          <Stack direction="row" justifyContent="flex-end">
            <Button variant="outlined" color={accentColor} onClick={resetQueue}>Send Another Blast</Button>
          </Stack>
        )}

      </Stack>

      {/* ── Load Previous Dialog ── */}
      <Dialog open={loadPrevOpen} onClose={() => setLoadPrevOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Load Previous Campaign</DialogTitle>
        <DialogContent>
          {loadingPrev ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : prevBlasts.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>No previous blasts found.</Typography>
          ) : (
            <Stack spacing={1} sx={{ mt: 1 }}>
              {prevBlasts.map(blast => (
                <Card key={blast._id}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => restorePrevBlast(blast)}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={700}>{blast.title || 'Untitled'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatWhen(blast.createdAt)} · {blast.totalRecipients || 0} recipients
                        </Typography>
                        {blast.message && (
                          <Typography variant="body2" color="text.secondary"
                            sx={{ mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {blast.message}
                          </Typography>
                        )}
                      </Box>
                      <Stack alignItems="flex-end" spacing={0.5}>
                        <Chip label={blast.status || 'DRAFT'} size="small"
                          color={
                            blast.status === 'COMPLETED' ? 'success' :
                            blast.status === 'SENDING'   ? 'warning' :
                            blast.status === 'CANCELLED' ? 'error'   : 'default'
                          } />
                        {blast.status === 'COMPLETED' && (
                          <Typography variant="caption" color="text.secondary">
                            {blast.sentCount || 0} sent · {blast.failedCount || 0} failed
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoadPrevOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </PageSurface>
  );
}

// ── Blast History Panel ───────────────────────────────────────────────────────

function BlastHistoryPanel({ isBaileys }) {
  const [blasts,        setBlasts]        = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [selectedBlast, setSelectedBlast] = useState(null);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadBlasts = useCallback(async () => {
    setLoading(true);
    try {
      const { default: api } = await import('../api');
      const res = await api.get('/blasts');
      setBlasts(Array.isArray(res.data) ? res.data : []);
    } catch (_) { setBlasts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadBlasts(); }, [loadBlasts]);

  const openBlast = async (blast) => {
    setDetailOpen(true);
    setLoadingDetail(true);
    try {
      const { default: api } = await import('../api');
      const res = await api.get(`/blasts/${blast._id}`);
      setSelectedBlast(res.data);
    } catch (_) { setSelectedBlast(blast); }
    finally { setLoadingDetail(false); }
  };

  return (
    <PageSurface>
      <Stack spacing={2}>
        <Card><CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" fontWeight={800}>
                {isBaileys ? '🐝 Baileys Blast History' : '📊 Blast History'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All saved WhatsApp blast campaigns with delivery stats. Click a row to see the full report.
              </Typography>
            </Box>
            <Button variant="outlined"
              startIcon={loading ? <CircularProgress size={16} /> : <HistoryIcon />}
              onClick={loadBlasts} disabled={loading}>Refresh</Button>
          </Stack>
        </CardContent></Card>

        {loading && <LinearProgress />}

        {blasts.length === 0 && !loading && (
          <Card><CardContent>
            <Typography color="text.secondary">
              No blast campaigns yet. Start a blast from the Invitation tab.
            </Typography>
          </CardContent></Card>
        )}

        {blasts.map(blast => (
          <Card key={blast._id}
            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => openBlast(blast)}>
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', sm: 'center' }}
                spacing={2}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700}>{blast.title || 'Untitled'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatWhen(blast.createdAt)}
                  </Typography>
                  {blast.message && (
                    <Typography variant="body2" color="text.secondary"
                      sx={{ mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {blast.message}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={2} alignItems="center" flexShrink={0}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700}>{blast.totalRecipients || 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700} color="success.main">{blast.sentCount || 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Sent</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700} color="error.main">{blast.failedCount || 0}</Typography>
                    <Typography variant="caption" color="text.secondary">Failed</Typography>
                  </Box>
                  <Chip label={blast.status || 'DRAFT'} size="small"
                    color={
                      blast.status === 'COMPLETED' ? 'success' :
                      blast.status === 'SENDING'   ? 'warning' :
                      blast.status === 'CANCELLED' ? 'error'   : 'default'
                    } />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Detail Dialog */}
      <Dialog
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedBlast(null); }}
        maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={800}>{selectedBlast?.title || 'Blast Report'}</Typography>
            <Chip label={selectedBlast?.status || ''}  size="small"
              color={
                selectedBlast?.status === 'COMPLETED' ? 'success' :
                selectedBlast?.status === 'SENDING'   ? 'warning' :
                selectedBlast?.status === 'CANCELLED' ? 'error'   : 'default'
              } />
          </Stack>
        </DialogTitle>
        <DialogContent>
          {loadingDetail ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedBlast ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {/* Stats row */}
              <Grid container spacing={2}>
                {[
                  { label: 'Total',  value: selectedBlast.totalRecipients || 0, color: 'text.primary'  },
                  { label: 'Sent',   value: selectedBlast.sentCount        || 0, color: 'success.main' },
                  { label: 'Failed', value: selectedBlast.failedCount      || 0, color: 'error.main'   },
                ].map(s => (
                  <Grid key={s.label} size={{ xs: 4 }}>
                    <Card><CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={700} color={s.color}>{s.value}</Typography>
                      <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                    </CardContent></Card>
                  </Grid>
                ))}
              </Grid>

              {/* Message */}
              {selectedBlast.message && (
                <Card><CardContent>
                  <Typography fontWeight={700} sx={{ mb: 1 }}>Message</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selectedBlast.message}</Typography>
                  {selectedBlast.includeRsvp && (
                    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        RSVP ✅ <em>{selectedBlast.rsvpYesLabel}</em>{' '}
                        ❌ <em>{selectedBlast.rsvpNoLabel}</em>
                      </Typography>
                    </Box>
                  )}
                </CardContent></Card>
              )}

              {/* Image */}
              {selectedBlast.imageUrl && (
                <Card><CardContent>
                  <Typography fontWeight={700} sx={{ mb: 1 }}>Image</Typography>
                  <Box component="img" src={selectedBlast.imageUrl} alt="Blast image"
                    sx={{ maxWidth: 300, maxHeight: 200, objectFit: 'contain', borderRadius: 1, display: 'block' }} />
                </CardContent></Card>
              )}

              {/* Per-recipient delivery */}
              {Array.isArray(selectedBlast.recipients) && selectedBlast.recipients.length > 0 && (
                <Card><CardContent>
                  <Typography fontWeight={700} sx={{ mb: 1 }}>
                    Per-Recipient Delivery ({selectedBlast.recipients.length})
                  </Typography>
                  <Box sx={{ maxHeight: 360, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    {selectedBlast.recipients.map((r, idx) => (
                      <Stack key={idx} direction="row" alignItems="center" spacing={1.5}
                        sx={{
                          px: 1.5, py: 0.75,
                          borderBottom: idx < selectedBlast.recipients.length - 1 ? '1px solid' : 'none',
                          borderColor: 'divider',
                        }}>
                        <Typography variant="body2" sx={{ minWidth: 28, color: 'text.secondary' }}>{idx + 1}</Typography>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{r.mobile}</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {r.sentAt ? formatWhen(r.sentAt) : '—'}
                        </Typography>
                        <Chip size="small" label={r.status}
                          color={r.status === 'SENT' ? 'success' : r.status === 'FAILED' ? 'error' : 'default'} />
                        {r.error && (
                          <Tooltip title={r.error}>
                            <Typography variant="caption" color="error"
                              sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.error}
                            </Typography>
                          </Tooltip>
                        )}
                      </Stack>
                    ))}
                  </Box>
                </CardContent></Card>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDetailOpen(false); setSelectedBlast(null); }}>Close</Button>
        </DialogActions>
      </Dialog>
    </PageSurface>
  );
}

// ── Logs panel ────────────────────────────────────────────────────────────────

function LogsPanel({ logs, isBaileys }) {
  const logRows = {
    columns: [
      { key: 'contact',   label: 'Contact'   },
      { key: 'direction', label: 'Direction' },
      { key: 'source',    label: 'Source'    },
      { key: 'message',   label: 'Message'   },
      { key: 'status',    label: 'Status'    },
      { key: 'when',      label: 'Time'      },
    ],
    data: logs.map(item => ({
      title:     item.contactName || item.from || item.to || 'Message',
      contact:   item.contactName || item.from || item.to || '-',
      direction: item.direction || '-',
      source:    item.source    || '-',
      message:   item.bodyText  || item.text  || '-',
      status: () => (
        <Chip label={item.status || '-'} size="small"
          color={
            item.status === 'SENT' || item.status === 'READ' ? 'success' :
            item.status === 'FAILED' ? 'error' : 'default'
          } />
      ),
      when: formatWhen(item.createdAt),
    })),
  };
  return (
    <CollectionSection
      title={isBaileys ? '🐝 Baileys Message Logs' : 'Message Logs'}
      subtitle={isBaileys
        ? 'All Baileys messages: incoming, outgoing, auto replies and invitations.'
        : 'Incoming webhook messages, manual replies and auto replies.'}
      rows={logRows}
    />
  );
}

// ── Baileys Setup / QR ────────────────────────────────────────────────────────

function BaileysSetup({ status, onConnect, onDisconnect, connecting, onRefresh }) {
  const isConnected    = status?.status === 'CONNECTED';
  const isQrPending    = status?.status === 'QR_PENDING';
  const isDisconnected = !isConnected && !isQrPending;

  useEffect(() => {
    const id = setInterval(onRefresh, 2000);
    return () => clearInterval(id);
  }, [onRefresh]);

  const [qrAge,  setQrAge]  = useState(0);
  const prevQrRef           = useRef(null);

  useEffect(() => {
    if (status?.qr && status.qr !== prevQrRef.current) {
      prevQrRef.current = status.qr;
      setQrAge(0);
    }
  }, [status?.qr]);

  useEffect(() => {
    if (!isQrPending) { setQrAge(0); return; }
    const id = setInterval(() => setQrAge(a => a + 1), 1000);
    return () => clearInterval(id);
  }, [isQrPending]);

  const qrSecondsLeft = Math.max(0, 20 - qrAge);
  const qrExpired     = isQrPending && qrSecondsLeft === 0;

  return (
    <PageSurface>
      <Card><CardContent>
        <Stack spacing={3}>

          <Stack direction="row" alignItems="center" spacing={2}>
            <QrCode2Icon sx={{ fontSize: 40, color: 'warning.main' }} />
            <Box>
              <Typography variant="h6" fontWeight={800}>Baileys Connection Setup</Typography>
              <Typography color="text.secondary">
                Connects your personal WhatsApp number via QR scan (like WhatsApp Web).
              </Typography>
            </Box>
          </Stack>

          <Alert severity="warning">
            <strong>Unofficial API:</strong> Baileys uses the WhatsApp Web protocol.
            Use for internal/testing purposes only.
          </Alert>

          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Chip
              label={`● ${status?.status || 'UNKNOWN'}`}
              color={isConnected ? 'success' : isQrPending ? 'warning' : 'default'}
            />
            {status?.phone && (
              <Chip label={`📱 +${status.phone}`} variant="outlined" color="success" />
            )}
            <Chip size="small" label="● LIVE" color="info" variant="outlined" />
          </Stack>

          {isQrPending && status?.qr && (
            <Box>
              <Alert severity={qrExpired ? 'error' : 'info'} sx={{ mb: 2 }}>
                {qrExpired
                  ? '⏱ QR expired — next QR loading automatically…'
                  : (
                    <>
                      <strong>Open WhatsApp</strong> → tap ⋮ → <strong>Linked Devices</strong> →{' '}
                      <strong>Link a Device</strong> → scan below
                      &nbsp;·&nbsp; refreshes in <strong>{qrSecondsLeft}s</strong>
                    </>
                  )}
              </Alert>
              <Box
                component="img"
                src={status.qr}
                alt="WhatsApp QR Code"
                sx={{
                  display: 'block', width: 260, height: 260,
                  border: '4px solid',
                  borderColor: qrExpired ? 'error.main' : 'warning.main',
                  borderRadius: 2, mb: 1,
                  opacity: qrExpired ? 0.3 : 1,
                  transition: 'opacity 0.4s, border-color 0.4s',
                }}
              />
              {qrExpired && (
                <Typography variant="body2" color="error">
                  ⟳ Waiting for next QR from WhatsApp server…
                </Typography>
              )}
            </Box>
          )}

          {connecting && !isQrPending && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={22} color="warning" />
              <Typography variant="body2" color="text.secondary">
                Connecting to WhatsApp — QR will appear here automatically…
              </Typography>
            </Stack>
          )}

          {isConnected && (
            <Alert severity="success">
              ✅ Connected as <strong>+{status.phone}</strong>.
              Registration confirmations and messages are being sent automatically.
            </Alert>
          )}

          {isDisconnected && !connecting && (
            <Alert severity="info">
              Click <strong>Connect</strong> to start.
              If previously connected, saved credentials will be used — no QR scan needed.
            </Alert>
          )}

          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button
              variant="contained" color="warning"
              startIcon={connecting ? <CircularProgress size={16} color="inherit" /> : <LinkIcon />}
              onClick={onConnect}
              disabled={connecting || isConnected}
            >
              {isQrPending ? 'Get New QR' : 'Connect'}
            </Button>
            <Button
              variant="outlined" color="error"
              startIcon={<LinkOffIcon />}
              onClick={onDisconnect}
              disabled={isDisconnected && !connecting}
            >
              Disconnect &amp; Reset
            </Button>
          </Stack>

          <Divider />

          <Box>
            <Typography fontWeight={700} sx={{ mb: 1 }}>Setup Notes</Typography>
            <Typography variant="body2" color="text.secondary">
              • Backend: <code>npm install @whiskeysockets/baileys qrcode pino</code>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              • Auth stored in <strong>MongoDB</strong> — survives server restarts.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              • Server <strong>auto-reconnects</strong> on boot if credentials exist.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              • QR on this page refreshes automatically every ~20s — just keep it open and scan.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              • Scan failing? Click <strong>Disconnect &amp; Reset</strong> → wait 5s → <strong>Connect</strong>.
            </Typography>
          </Box>

        </Stack>
      </CardContent></Card>
    </PageSurface>
  );
}

// ── Rule dialog ───────────────────────────────────────────────────────────────

function RuleDialog({ open, onClose, editing, form, setForm, onSave, saving, isBaileys }) {
  return (
    <ResponsiveDialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight={800}>
            {editing ? 'Edit' : 'Add'} Auto Reply Rule{isBaileys ? ' (Baileys)' : ''}
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField label="Rule Name" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField type="number" label="Priority" value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: Number(e.target.value) }))} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField select label="Match Type" value={form.matchType}
                onChange={e => setForm(p => ({ ...p, matchType: e.target.value }))}>
                {['CONTAINS', 'EXACT', 'STARTS_WITH', 'ALL'].map(v =>
                  <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Trigger Text" value={form.triggerText}
                onChange={e => setForm(p => ({ ...p, triggerText: e.target.value }))}
                helperText="Leave blank only when match type is ALL." />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField select label="Reply Type" value={form.replyType}
                onChange={e => setForm(p => ({ ...p, replyType: e.target.value }))}>
                {['TEXT', 'TEMPLATE'].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField select label="Active" value={form.isActive ? 'true' : 'false'}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.value === 'true' }))}>
                <MenuItem value="true">Active</MenuItem>
                <MenuItem value="false">Inactive</MenuItem>
              </TextField>
            </Grid>
            {form.replyType === 'TEXT' && (
              <Grid size={{ xs: 12 }}>
                <TextField label="Reply Text" multiline minRows={3} value={form.replyText}
                  onChange={e => setForm(p => ({ ...p, replyText: e.target.value }))} />
              </Grid>
            )}
            {form.replyType === 'TEMPLATE' && (
              <>
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField label="Template Name" value={form.templateName}
                    onChange={e => setForm(p => ({ ...p, templateName: e.target.value }))} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField label="Language" value={form.templateLanguage}
                    onChange={e => setForm(p => ({ ...p, templateLanguage: e.target.value }))} />
                </Grid>
              </>
            )}
            <Grid size={{ xs: 12 }}>
              <FormControlLabel label="Stop after first match"
                control={<Checkbox checked={form.stopAfterMatch}
                  onChange={e => setForm(p => ({ ...p, stopAfterMatch: e.target.checked }))} />} />
            </Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" color={isBaileys ? 'warning' : 'primary'}
              disabled={saving || !form.name} onClick={onSave}>
              {saving ? 'Saving…' : 'Save Rule'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </ResponsiveDialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main page
// ══════════════════════════════════════════════════════════════════════════════

// ── Manual Invite Panel (wa.me link generator) ────────────────────────────────

function ManualInvitePanel({ isBaileys }) {
  const [form, setForm] = useState({
    title: '', message: 'Hi {name}!', imageUrl: '', recipientMode: 'single',
    singleName: '', singleNumber: '',
  });
  const [recipients,     setRecipients]     = useState([]);
  const [sentSet,        setSentSet]         = useState(new Set());
  const [uploadingImage, setUploadingImage]  = useState(false);
  const [saving,         setSaving]          = useState(false);
  const [savedId,        setSavedId]         = useState(null);
  const [fileName,       setFileName]        = useState('');

  const canvasRef  = useRef(null);
  const imageElRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!form.imageUrl) { setImageLoaded(false); imageElRef.current = null; return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => { imageElRef.current = img; setImageLoaded(true); };
    img.onerror = () => { imageElRef.current = null; setImageLoaded(false); };
    img.src = form.imageUrl;
  }, [form.imageUrl]);

  useEffect(() => {
    if (imageLoaded && canvasRef.current && imageElRef.current) {
      canvasRef.current.width  = 300;
      canvasRef.current.height = Math.round(300 * imageElRef.current.naturalHeight / imageElRef.current.naturalWidth) || 200;
      drawNameOnCanvas(canvasRef.current, imageElRef.current, 'Preview', emptyFontStyle);
    }
  }, [imageLoaded]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const buffer   = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const rows     = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    setRecipients(parseRowsToRecipients(rows).map(r => ({ ...r, checked: true })));
  };

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'wa_manual_invites');
      const { default: api } = await import('../api');
      const res = await api.post('/uploads/public', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(p => ({ ...p, imageUrl: res?.data?.url || '' }));
    } finally { setUploadingImage(false); }
  };

  const buildWaUrl = (name, mobile) => {
    const phone = normalizePhone(mobile);
    const msg   = encodeURIComponent((form.message || '').replace(/\{name\}/gi, name));
    return `https://wa.me/${phone}?text=${msg}`;
  };

  const effectiveRecipients = form.recipientMode === 'single'
    ? [{ name: form.singleName || 'Guest', mobile: form.singleNumber }]
    : recipients.filter(r => r.checked !== false);

  const handleMarkSent = (idx) => {
    setSentSet(prev => { const n = new Set(prev); n.add(idx); return n; });
  };

  const handleSaveCampaign = async () => {
    if (!effectiveRecipients.length) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title || 'Manual Campaign',
        message: form.message,
        imageUrl: form.imageUrl,
        type: 'MANUAL',
        status: 'SENT',
        recipients: effectiveRecipients.map((r, i) => ({
          name: r.name, mobile: r.mobile,
          waUrl: buildWaUrl(r.name, r.mobile),
          status: sentSet.has(i) ? 'SENT' : 'PENDING',
        })),
        sentCount:   [...sentSet].length,
        failedCount: 0,
      };
      const res = await whatsappService.saveCampaign(payload);
      setSavedId(res.data._id);
    } catch (e) {
      console.error('[manual] save error:', e.message);
    } finally { setSaving(false); }
  };

  return (
    <PageSurface>
      <Card><CardContent>
        <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
          {isBaileys ? '🐝 Manual wa.me Generator' : '📲 Manual wa.me Generator'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Use this when the API is unavailable. Click each link to open WhatsApp web/app with a pre-filled message for each recipient.
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField label="Campaign Title" fullWidth value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))} sx={{ mb: 2 }} />
            <TextField label="Message (use {name} for recipient name)" fullWidth multiline minRows={3}
              value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select label="Recipients" fullWidth value={form.recipientMode}
              onChange={e => { setForm(p => ({ ...p, recipientMode: e.target.value })); setRecipients([]); }}
              sx={{ mb: 2 }}>
              <MenuItem value="single">Single Number</MenuItem>
              <MenuItem value="excel">Excel / CSV File</MenuItem>
            </TextField>
            {form.recipientMode === 'single' ? (
              <Stack spacing={1.5}>
                <TextField label="Name" value={form.singleName} onChange={e => setForm(p => ({ ...p, singleName: e.target.value }))} />
                <TextField label="Phone (10-digit or with country code)" value={form.singleNumber} onChange={e => setForm(p => ({ ...p, singleNumber: e.target.value }))} />
              </Stack>
            ) : (
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                  Upload Excel / CSV
                  <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                </Button>
                {fileName && <Typography variant="body2" color="text.secondary">{fileName} ({recipients.length} rows)</Typography>}
              </Stack>
            )}
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={uploadingImage}>
                {uploadingImage ? 'Uploading…' : 'Attach Image (optional)'}
                <input type="file" hidden accept="image/*" onChange={handleUploadImage} />
              </Button>
              {form.imageUrl && <Typography variant="body2" color="success.main">Image uploaded</Typography>}
            </Stack>
            {imageLoaded && (
              <Box sx={{ mt: 1.5 }}>
                <canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: 8 }} />
              </Box>
            )}
          </Grid>
        </Grid>

        {effectiveRecipients.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography fontWeight={700} sx={{ mb: 1.5 }}>
              Recipients — {effectiveRecipients.length} total · {sentSet.size} marked sent
            </Typography>
            <Stack spacing={1}>
              {effectiveRecipients.map((r, idx) => {
                const url  = buildWaUrl(r.name, r.mobile);
                const sent = sentSet.has(idx);
                return (
                  <Card key={idx} variant="outlined" sx={{ bgcolor: sent ? '#f0fdf4' : undefined }}>
                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
                        <Box>
                          <Typography fontWeight={700}>{r.name}</Typography>
                          <Typography variant="body2" color="text.secondary">{r.mobile}</Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {sent && <Chip label="Sent" color="success" size="small" />}
                          <Button
                            variant="contained"
                            color={sent ? 'success' : (isBaileys ? 'warning' : 'primary')}
                            size="small"
                            component="a"
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleMarkSent(idx)}
                          >
                            Open wa.me
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <Button
                variant="contained" color="secondary"
                disabled={saving || effectiveRecipients.length === 0}
                onClick={handleSaveCampaign}
              >
                {saving ? 'Saving…' : 'Save Campaign'}
              </Button>
              {savedId && <Chip label="Saved!" color="success" />}
            </Stack>
          </Box>
        )}
      </CardContent></Card>
    </PageSurface>
  );
}

// ── Campaigns Panel ───────────────────────────────────────────────────────────

function CampaignsPanel({ isBaileys }) {
  const [campaigns,  setCampaigns]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [expanded,   setExpanded]   = useState(null);
  const [sending,    setSending]    = useState(null);
  const [deleting,   setDeleting]   = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await whatsappService.listCampaigns();
      setCampaigns(Array.isArray(res.data) ? res.data : []);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSend = async (id) => {
    setSending(id);
    try {
      await whatsappService.sendCampaignNow(id);
      await load();
    } catch (e) {
      console.error('[campaigns] send error:', e.message);
    } finally { setSending(null); }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await whatsappService.deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c._id !== id));
    } finally { setDeleting(null); }
  };

  const statusColor = (s) =>
    s === 'SENT'      ? 'success' :
    s === 'SENDING'   ? 'warning' :
    s === 'SCHEDULED' ? 'info'    :
    s === 'CANCELLED' ? 'error'   : 'default';

  return (
    <PageSurface>
      <Card><CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={800}>Campaigns</Typography>
            <Typography variant="body2" color="text.secondary">
              Saved manual and scheduled WhatsApp campaigns with per-recipient tracking.
            </Typography>
          </Box>
          <Button variant="outlined" onClick={load} disabled={loading}>Refresh</Button>
        </Stack>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {campaigns.length === 0 && !loading && (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            No campaigns yet. Use the Invitation or Manual tab to create one.
          </Typography>
        )}

        <Stack spacing={1.5}>
          {campaigns.map(c => (
            <Accordion
              key={c._id}
              expanded={expanded === c._id}
              onChange={(_, open) => setExpanded(open ? c._id : null)}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" sx={{ width: '100%' }}>
                  <Typography fontWeight={700} sx={{ flex: 1 }}>{c.title || 'Untitled'}</Typography>
                  <Chip label={c.status} color={statusColor(c.status)} size="small" />
                  <Chip label={`${c.type}`} variant="outlined" size="small" />
                  <Typography variant="caption" color="text.secondary">
                    {c.recipients?.length || 0} recipients · {c.sentCount || 0} sent · {c.failedCount || 0} failed
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{formatWhen(c.createdAt)}</Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.5}>
                  {c.message && (
                    <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{c.message}</Typography>
                    </Box>
                  )}
                  {c.imageUrl && (
                    <Box component="img" src={c.imageUrl} sx={{ maxWidth: 200, borderRadius: 1 }} />
                  )}

                  <Stack direction="row" spacing={1}>
                    {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                      <Button
                        variant="contained"
                        color={isBaileys ? 'warning' : 'primary'}
                        size="small"
                        disabled={sending === c._id}
                        onClick={() => handleSend(c._id)}
                        startIcon={<SendIcon />}
                      >
                        {sending === c._id ? 'Starting…' : 'Send Now'}
                      </Button>
                    )}
                    <Button
                      variant="outlined" color="error" size="small"
                      disabled={deleting === c._id}
                      onClick={() => handleDelete(c._id)}
                    >
                      {deleting === c._id ? 'Deleting…' : 'Delete'}
                    </Button>
                  </Stack>

                  {c.recipients?.length > 0 && (
                    <Box>
                      <Typography fontWeight={700} sx={{ mb: 1 }}>Recipients</Typography>
                      <Stack spacing={0.5}>
                        {c.recipients.map((r, i) => (
                          <Stack key={i} direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                            <Typography variant="body2" sx={{ flex: 1 }}>{r.name} · {r.mobile}</Typography>
                            <Chip
                              label={r.status}
                              color={r.status === 'SENT' ? 'success' : r.status === 'FAILED' ? 'error' : 'default'}
                              size="small"
                            />
                            {r.waUrl && (
                              <Button
                                size="small" variant="outlined"
                                component="a" href={r.waUrl} target="_blank" rel="noopener noreferrer"
                              >
                                wa.me
                              </Button>
                            )}
                            {r.error && <Typography variant="caption" color="error">{r.error}</Typography>}
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      </CardContent></Card>
    </PageSurface>
  );
}

// ── Group Members Panel ───────────────────────────────────────────────────────

function GroupMembersPanel() {
  const [groups,          setGroups]          = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [roleFilter,      setRoleFilter]      = useState('all');
  const [search,          setSearch]          = useState('');
  const [checked,         setChecked]         = useState(new Set());
  const [importing,       setImporting]       = useState(false);
  const [importResult,    setImportResult]    = useState(null);

  useEffect(() => {
    setLoading(true);
    whatsappService.baileysGetGroupsWithMembers()
      .then(({ data }) => setGroups(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allMembers = useMemo(() => {
    const result = [];
    for (const g of groups) {
      if (selectedGroupId && g.id !== selectedGroupId) continue;
      for (const m of g.members || []) {
        if (roleFilter === 'admin'  &&  !m.isAdmin) continue;
        if (roleFilter === 'member' &&   m.isAdmin) continue;
        const q = search.toLowerCase();
        if (q && !m.name.toLowerCase().includes(q) && !m.phone.includes(q)) continue;
        result.push({ ...m, groupId: g.id, groupName: g.name, key: `${g.id}::${m.phone}` });
      }
    }
    return result;
  }, [groups, selectedGroupId, roleFilter, search]);

  const allChecked  = allMembers.length > 0 && checked.size === allMembers.length;
  const someChecked = checked.size > 0 && !allChecked;

  const toggleAll = () => {
    if (allChecked) { setChecked(new Set()); return; }
    setChecked(new Set(allMembers.map(m => m.key)));
  };
  const toggleOne = key => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const exportRows = () => checked.size > 0 ? allMembers.filter(m => checked.has(m.key)) : allMembers;

  const exportCSV = () => {
    const rows = exportRows();
    const csv = ['Name,Phone,Group,Role',
      ...rows.map(m => `"${m.name}","${m.phone}","${m.groupName}",${m.isAdmin ? 'Admin' : 'Member'}`)
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'group-members.csv' });
    a.click(); URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      exportRows().map(m => ({ Name: m.name, Phone: m.phone, Group: m.groupName, Role: m.isAdmin ? 'Admin' : 'Member' }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    XLSX.writeFile(wb, 'group-members.xlsx');
  };

  const exportJSON = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportRows(), null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'group-members.json' });
    a.click(); URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['Name', 'Phone', 'Group', 'Role']],
      body: exportRows().map(m => [m.name, m.phone, m.groupName, m.isAdmin ? 'Admin' : 'Member']),
    });
    doc.save('group-members.pdf');
  };

  const handleImport = async () => {
    const contacts = exportRows().map(m => ({
      name: m.name, mobile: m.phone, groupId: m.groupId, groupName: m.groupName, isAdmin: m.isAdmin,
    }));
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await whatsappService.baileysImportGroupContacts({ contacts });
      setImportResult(data);
    } catch (e) {
      setImportResult({ error: e?.response?.data?.message || 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  const totalMembers = groups.reduce((s, g) => s + (g.members?.length || 0), 0);

  return (
    <Stack spacing={2}>
      {/* Summary chips */}
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Chip icon={<GroupsIcon />} label={`${groups.length} Groups`} variant="outlined" />
        <Chip label={`${totalMembers} Total Members`} variant="outlined" />
        <Chip label={`${allMembers.length} Shown`} color="primary" variant="outlined" />
        {checked.size > 0 && <Chip label={`${checked.size} Selected`} color="secondary" />}
      </Stack>

      {/* Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
        <TextField select label="Group" size="small" value={selectedGroupId}
          onChange={e => { setSelectedGroupId(e.target.value); setChecked(new Set()); }}
          sx={{ minWidth: 200 }}>
          <MenuItem value="">All Groups</MenuItem>
          {groups.map(g => <MenuItem key={g.id} value={g.id}>{g.name} ({g.members?.length || 0})</MenuItem>)}
        </TextField>
        <TextField select label="Role" size="small" value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setChecked(new Set()); }}
          sx={{ minWidth: 140 }}>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="admin">Admins Only</MenuItem>
          <MenuItem value="member">Members Only</MenuItem>
        </TextField>
        <TextField size="small" placeholder="Search name or phone…" value={search}
          onChange={e => { setSearch(e.target.value); setChecked(new Set()); }}
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <Button variant="outlined" size="small" onClick={() => {
          setLoading(true);
          whatsappService.baileysGetGroupsWithMembers()
            .then(({ data }) => setGroups(data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
        }}>Refresh</Button>
      </Stack>

      {/* Export + Import actions */}
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', mr: 1 }}>
          Export{checked.size > 0 ? ` ${checked.size} selected` : ' all shown'}:
        </Typography>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportCSV}>CSV</Button>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportExcel}>Excel</Button>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportJSON}>JSON</Button>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportPDF}>PDF</Button>
        <Button size="small" variant="contained" startIcon={<SaveAltIcon />}
          onClick={handleImport} disabled={importing || allMembers.length === 0}>
          {importing ? 'Importing…' : `Add to MongoDB${checked.size > 0 ? ` (${checked.size})` : ''}`}
        </Button>
      </Stack>

      {importResult && (
        <Alert severity={importResult.error ? 'error' : 'success'} onClose={() => setImportResult(null)}>
          {importResult.error || `Imported ${importResult.imported} contacts, ${importResult.skipped} skipped.`}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : allMembers.length === 0 ? (
        <Alert severity="info">
          {groups.length === 0
            ? 'No groups found. Make sure Baileys is connected and you are in at least one WhatsApp group.'
            : 'No members match the current filters.'}
        </Alert>
      ) : (
        <Paper variant="outlined">
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={allChecked} indeterminate={someChecked} onChange={toggleAll} />
                  </TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Group</TableCell>
                  <TableCell>Role</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allMembers.map(m => (
                  <TableRow key={m.key} hover selected={checked.has(m.key)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(m.key)} onChange={() => toggleOne(m.key)} />
                    </TableCell>
                    <TableCell>{m.name || <Typography variant="body2" color="text.disabled">—</Typography>}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{m.phone}</TableCell>
                    <TableCell>{m.groupName}</TableCell>
                    <TableCell>
                      <Chip label={m.isAdmin ? 'Admin' : 'Member'} size="small"
                        color={m.isAdmin ? 'warning' : 'default'} variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function WhatsAppPage() {

  const [useBaileys, setUseBaileys] = useState(
    () => localStorage.getItem('wa_provider') !== 'official'
  );

  const [tab,        setTab]        = useState('inbox');
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [resultMessage, setResultMessage] = useState(null);

  // ── Official API state ────────────────────────────────────────────────────
  const [inbox,                   setInbox]                   = useState([]);
  const [selectedConversationKey, setSelectedConversationKey] = useState('');
  const [conversationMessages,    setConversationMessages]    = useState([]);
  const [replyForm,               setReplyForm]               = useState({ text: '', templateName: '' });
  const [templates,               setTemplates]               = useState([]);
  const [rules,                   setRules]                   = useState([]);
  const [connections,             setConnections]             = useState([]);
  const [logs,                    setLogs]                    = useState([]);
  const [ruleOpen,                setRuleOpen]                = useState(false);
  const [editingRule,             setEditingRule]             = useState(null);
  const [ruleForm,                setRuleForm]                = useState(emptyRule);
  const [invitationForm,          setInvitationForm]          = useState(emptyInvitationForm);
  const [selectedRecipients,      setSelectedRecipients]      = useState([]);
  const [fontStyle,               setFontStyle]               = useState(emptyFontStyle);
  const [uploadingImage,          setUploadingImage]          = useState(false);
  const [fileName,                setFileName]                = useState('');

  // ── Baileys state ─────────────────────────────────────────────────────────
  const [baileysStatus,      setBaileysStatus]      = useState({ status: 'DISCONNECTED', qr: null, phone: '' });
  const [baileysConnecting,  setBaileysConnecting]  = useState(false);
  const [baileysInbox,       setBaileysInbox]       = useState([]);
  const [baileysSelectedKey, setBaileysSelectedKey] = useState('');
  const [baileysConversation,setBaileysConversation]= useState([]);
  const [baileysReplyForm,   setBaileysReplyForm]   = useState({ text: '' });
  const [baileysRules,       setBaileysRules]       = useState([]);
  const [baileysRuleOpen,    setBaileysRuleOpen]    = useState(false);
  const [baileysEditingRule, setBaileysEditingRule] = useState(null);
  const [baileysRuleForm,    setBaileysRuleForm]    = useState(emptyRule);
  const [baileysInvitationForm,     setBaileysInvitationForm]     = useState(emptyInvitationForm);
  const [baileysSelectedRecipients, setBaileysSelectedRecipients] = useState([]);
  const [baileysFontStyle,          setBaileysFontStyle]          = useState(emptyFontStyle);
  const [baileysUploadingImage,     setBaileysUploadingImage]     = useState(false);
  const [baileysFileName,           setBaileysFileName]           = useState('');
  const [baileysLogs,               setBaileysLogs]               = useState([]);

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadOfficial = async () => {
    setLoading(true);
    try {
      const [inboxRes, tplRes, rulesRes, connsRes, logsRes] = await Promise.all([
        whatsappService.getInbox(),
        whatsappService.getTemplates(),
        whatsappService.getRules(),
        whatsappService.getConnections(),
        whatsappService.getMessages(),
      ]);
      const inboxData = Array.isArray(inboxRes.data) ? inboxRes.data : [];
      setInbox(inboxData);
      setTemplates(Array.isArray(tplRes.data)    ? tplRes.data   : []);
      setRules(Array.isArray(rulesRes.data)       ? rulesRes.data : []);
      setConnections(Array.isArray(connsRes.data) ? connsRes.data : []);
      setLogs(Array.isArray(logsRes.data)         ? logsRes.data  : []);
      if (!selectedConversationKey && inboxData[0]?.conversationKey)
        setSelectedConversationKey(inboxData[0].conversationKey);
    } catch (_) {}
    finally { setLoading(false); }
  };

  const loadOfficialConversation = async (key) => {
    if (!key) { setConversationMessages([]); return; }
    const { data } = await whatsappService.getConversation(key);
    setConversationMessages(Array.isArray(data) ? data : []);
    await whatsappService.markConversationRead(key).catch(() => null);
    const res = await whatsappService.getInbox();
    setInbox(Array.isArray(res.data) ? res.data : []);
  };

  const loadBaileys = async () => {
    setLoading(true);
    try {
      const [statusRes, inboxRes, rulesRes, logsRes] = await Promise.all([
        whatsappService.baileysGetStatus(),
        whatsappService.baileysGetInbox(),
        whatsappService.baileysGetRules(),
        whatsappService.baileysGetLogs(),
      ]);
      setBaileysStatus(statusRes.data || { status: 'DISCONNECTED' });
      const rows = Array.isArray(inboxRes.data) ? inboxRes.data : [];
      setBaileysInbox(rows);
      setBaileysRules(Array.isArray(rulesRes.data) ? rulesRes.data : []);
      setBaileysLogs(Array.isArray(logsRes.data)   ? logsRes.data  : []);
      if (!baileysSelectedKey && rows[0]?.conversationKey)
        setBaileysSelectedKey(rows[0].conversationKey);
    } catch (e) {
      console.error('loadBaileys error:', e);
    }
    finally { setLoading(false); }
  };

  const loadBaileysConversation = async (key) => {
    if (!key) { setBaileysConversation([]); return; }
    const { data } = await whatsappService.baileysGetConversation(key);
    setBaileysConversation(Array.isArray(data) ? data : []);
    await whatsappService.baileysMarkRead(key).catch(() => null);
  };

  useEffect(() => { if (useBaileys) loadBaileys(); else loadOfficial(); }, [useBaileys]);
  useEffect(() => { if (!useBaileys) loadOfficialConversation(selectedConversationKey); }, [selectedConversationKey]);
  useEffect(() => { if (useBaileys)  loadBaileysConversation(baileysSelectedKey);       }, [baileysSelectedKey]);

  const handleToggle = () => {
    setUseBaileys(v => {
      const next = !v;
      if (next) localStorage.removeItem('wa_provider');
      else      localStorage.setItem('wa_provider', 'official');
      return next;
    });
    setTab('inbox');
    setResultMessage(null);
  };

  // ── Baileys status refresh ────────────────────────────────────────────────
  const handleBaileysRefreshStatus = useCallback(async () => {
    try {
      const res = await whatsappService.baileysGetStatus();
      setBaileysStatus(res.data || { status: 'DISCONNECTED' });
    } catch (_) {}
  }, []);

  const connectPollerRef = useRef(null);
  const stopConnectPoller = () => {
    if (connectPollerRef.current) { clearInterval(connectPollerRef.current); connectPollerRef.current = null; }
  };

  const handleBaileysConnect = async () => {
    setBaileysConnecting(true);
    setBaileysStatus({ status: 'DISCONNECTED', qr: null, phone: '' });
    try {
      await whatsappService.baileysConnect();
      stopConnectPoller();
      let attempts = 0;
      connectPollerRef.current = setInterval(async () => {
        attempts++;
        try {
          const res = await whatsappService.baileysGetStatus();
          const s   = res.data || {};
          setBaileysStatus(s);
          if (s.status === 'QR_PENDING' || s.status === 'CONNECTED') setBaileysConnecting(false);
          if (s.status === 'CONNECTED' || attempts >= 90) {
            stopConnectPoller();
            setBaileysConnecting(false);
          }
        } catch (_) {}
      }, 1000);
    } catch (e) {
      setBaileysConnecting(false);
      setResultMessage({ type: 'error', text: e?.response?.data?.message || 'Failed to start Baileys' });
    }
  };

  const handleBaileysDisconnect = async () => {
    stopConnectPoller();
    try {
      await whatsappService.baileysDisconnect();
      setBaileysStatus({ status: 'DISCONNECTED', qr: null, phone: '' });
      setBaileysConnecting(false);
    } catch (e) {
      setResultMessage({ type: 'error', text: 'Failed to disconnect' });
    }
  };

  // ── Official handlers ─────────────────────────────────────────────────────
  const handleReplySend = async () => {
    const sel = inbox.find(i => i.conversationKey === selectedConversationKey);
    if (!sel?.phone || (!replyForm.text.trim() && !replyForm.templateName)) return;
    setSaving(true);
    try {
      await whatsappService.sendText({
        to: sel.phone, contactName: sel.contactName,
        text: replyForm.templateName ? '' : replyForm.text,
        templateName: replyForm.templateName,
        replyToMessageId: conversationMessages[conversationMessages.length - 1]?.waMessageId || '',
      });
      setReplyForm({ text: '', templateName: '' });
      await loadOfficial();
      await loadOfficialConversation(sel.conversationKey);
    } finally { setSaving(false); }
  };

  const handleQuickSend = async (form) => {
    setSaving(true);
    try {
      await whatsappService.sendText({ to: form.to, contactName: form.contactName, text: form.text, templateName: form.templateName });
      setResultMessage({ type: 'success', text: `Message sent to ${form.to}` });
    } catch (e) {
      setResultMessage({ type: 'error', text: e?.response?.data?.message || 'Send failed' });
    } finally { setSaving(false); }
  };

  const handleSaveRule = async () => {
    setSaving(true);
    try {
      await whatsappService.saveRule(ruleForm, editingRule?._id);
      setRuleOpen(false);
      await loadOfficial();
    } finally { setSaving(false); }
  };

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'bk_award_invites');
      const { default: api } = await import('../api');
      const response = await api.post('/uploads/public', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setInvitationForm(p => ({ ...p, imageUrl: response?.data?.url || '' }));
    } finally { setUploadingImage(false); }
  };

  // ── Baileys handlers ──────────────────────────────────────────────────────
  const handleBaileysReplySend = async () => {
    if (!baileysSelectedKey || !baileysReplyForm.text.trim()) return;
    setSaving(true);
    try {
      await whatsappService.baileysSendText({ to: baileysSelectedKey, text: baileysReplyForm.text, contactName: '' });
      setBaileysReplyForm({ text: '' });
      await loadBaileys();
      await loadBaileysConversation(baileysSelectedKey);
    } finally { setSaving(false); }
  };

  const handleBaileysQuickSend = async (form) => {
    setSaving(true);
    try {
      await whatsappService.baileysSendText(form);
      setResultMessage({ type: 'success', text: `Message sent to ${form.to}` });
      await loadBaileys();
    } catch (e) {
      setResultMessage({ type: 'error', text: e?.response?.data?.message || 'Send failed' });
    } finally { setSaving(false); }
  };

  const handleBaileysEditRule = (item) => { setBaileysEditingRule(item); setBaileysRuleForm({ ...emptyRule, ...item }); setBaileysRuleOpen(true); };
  const handleBaileysAddRule  = ()     => { setBaileysEditingRule(null); setBaileysRuleForm(emptyRule); setBaileysRuleOpen(true); };
  const handleBaileysSaveRule = async () => {
    setSaving(true);
    try {
      await whatsappService.baileysSaveRule(baileysRuleForm, baileysEditingRule?._id);
      setBaileysRuleOpen(false);
      await loadBaileys();
    } finally { setSaving(false); }
  };

  const handleBaileysUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBaileysUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'bk_award_invites');
      const { default: api } = await import('../api');
      const response = await api.post('/uploads/public', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBaileysInvitationForm(p => ({ ...p, imageUrl: response?.data?.url || '' }));
    } finally { setBaileysUploadingImage(false); }
  };

  // ── Table rows ────────────────────────────────────────────────────────────
  const officialRuleRows = {
    columns: [
      { key: 'name', label: 'Rule' }, { key: 'trigger', label: 'Trigger' },
      { key: 'reply', label: 'Reply' }, { key: 'status', label: 'Status' }, { key: 'action', label: 'Action' },
    ],
    data: rules.map(item => ({
      title: item.name || 'Rule', name: item.name || '-',
      trigger: `${item.matchType || '-'} • ${item.triggerText || 'ALL'}`,
      reply: item.replyType === 'TEMPLATE' ? item.templateName || '-' : item.replyText || '-',
      status: () => <Chip label={item.isActive ? 'Active' : 'Inactive'} color={item.isActive ? 'success' : 'default'} size="small" />,
      action: () => <Button size="small" variant="contained"
        onClick={() => { setEditingRule(item); setRuleForm({ ...emptyRule, ...item }); setRuleOpen(true); }}>Edit</Button>,
    })),
  };
  const templateRows = {
    columns: [{ key: 'name', label: 'Template' }, { key: 'category', label: 'Category' }, { key: 'language', label: 'Language' }],
    data: templates.map(item => ({
      title: item.displayName || item.name || 'Template',
      name: item.displayName || item.name || '-',
      category: item.category || '-',
      language: item.language || item.templateLanguage || '-',
    })),
  };
  const connectionsRows = {
    columns: [{ key: 'name', label: 'Name' }, { key: 'mode', label: 'Mode' }, { key: 'phoneNumberId', label: 'Phone ID' }, { key: 'businessAccountId', label: 'Business ID' }],
    data: connections.map(item => ({
      title: item.name || 'Connection', name: item.name || '-', mode: item.mode || '-',
      phoneNumberId: item.phoneNumberId || '-', businessAccountId: item.businessAccountId || '-',
    })),
  };
  const logRows = {
    columns: [{ key: 'contact', label: 'Contact' }, { key: 'direction', label: 'Direction' }, { key: 'message', label: 'Message' }, { key: 'when', label: 'Time' }],
    data: logs.map(item => ({
      title: item.contactName || item.phone || 'Message',
      contact: item.contactName || item.phone || '-',
      direction: item.direction || '-',
      message: item.bodyText || item.text || '-',
      when: formatWhen(item.createdAt),
    })),
  };

  const currentTabs = useBaileys ? baileysTabs : officialTabs;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ pb: 3 }}>
      <PageHeader
        eyebrow="Communication"
        title="WhatsApp Management"
        subtitle="Switch between Official Cloud API and Baileys with separate inboxes, auto-reply, invitation, blast history, and QR-based connection."
        chips={[
          { label: useBaileys ? '🐝 Baileys Mode' : '✅ Official API', color: useBaileys ? 'warning' : 'success' },
          { label: useBaileys ? `${baileysInbox.length} Conversations` : `${inbox.length} Conversations`, color: 'success' },
          ...(!useBaileys
            ? [{ label: `${templates.length} Templates` }, { label: `${rules.length} Rules` }]
            : [{ label: `${baileysRules.length} Rules` }]),
        ]}
      />

      <ProviderToggle useBaileys={useBaileys} onToggle={handleToggle} baileysStatus={baileysStatus?.status} />

      <PageSurface sx={{ mb: 2 }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant="scrollable" allowScrollButtonsMobile
          sx={{ minHeight: 0, '& .MuiTab-root': { minHeight: 42 } }}
          textColor={useBaileys ? 'warning' : 'primary'}
          indicatorColor={useBaileys ? 'warning' : 'primary'}
        >
          {currentTabs.map(([value, label]) => <Tab key={value} value={value} label={label} />)}
        </Tabs>
      </PageSurface>

      {loading       && <LinearProgress sx={{ mb: 2 }} />}
      {resultMessage && (
        <Alert sx={{ mb: 2 }} severity={resultMessage.type} onClose={() => setResultMessage(null)}>
          {resultMessage.text}
        </Alert>
      )}

      {/* ══════════════ BAILEYS TABS ══════════════ */}

      {useBaileys && tab === 'inbox' && (
        <InboxPanel
          inbox={baileysInbox} selectedKey={baileysSelectedKey} onSelect={setBaileysSelectedKey}
          conversationMessages={baileysConversation} replyForm={baileysReplyForm}
          setReplyForm={setBaileysReplyForm} onSend={handleBaileysReplySend} saving={saving} isBaileys
        />
      )}
      {useBaileys && tab === 'rules' && (
        <>
          <AutoReplyPanel rules={baileysRules} onAdd={handleBaileysAddRule} onEdit={handleBaileysEditRule} isBaileys />
          <RuleDialog open={baileysRuleOpen} onClose={() => setBaileysRuleOpen(false)}
            editing={baileysEditingRule} form={baileysRuleForm} setForm={setBaileysRuleForm}
            onSave={handleBaileysSaveRule} saving={saving} isBaileys />
        </>
      )}
      {useBaileys && tab === 'send' && (
        <QuickSendPanel onSend={handleBaileysQuickSend} saving={saving} isBaileys />
      )}
      {useBaileys && tab === 'invite' && (
        <InvitationPanel
          isBaileys
          invitationForm={baileysInvitationForm}   setInvitationForm={setBaileysInvitationForm}
          selectedRecipients={baileysSelectedRecipients} setSelectedRecipients={setBaileysSelectedRecipients}
          fontStyle={baileysFontStyle}             setFontStyle={setBaileysFontStyle}
          onUploadImage={handleBaileysUploadImage} uploadingImage={baileysUploadingImage}
          sendServiceFn={whatsappService.baileysSendInvitation}
          fileName={baileysFileName}               setFileName={setBaileysFileName}
        />
      )}
      {useBaileys && tab === 'manual'    && <ManualInvitePanel isBaileys />}
      {useBaileys && tab === 'campaigns' && <CampaignsPanel    isBaileys />}
      {useBaileys && tab === 'history'   && <BlastHistoryPanel isBaileys />}
      {useBaileys && tab === 'logs'      && <LogsPanel logs={baileysLogs} isBaileys />}
      {useBaileys && tab === 'groups'  && <GroupMembersPanel />}
      {useBaileys && tab === 'setup'   && (
        <BaileysSetup
          status={baileysStatus}
          onConnect={handleBaileysConnect}
          onDisconnect={handleBaileysDisconnect}
          connecting={baileysConnecting}
          onRefresh={handleBaileysRefreshStatus}
        />
      )}

      {/* ══════════════ OFFICIAL TABS ══════════════ */}

      {!useBaileys && tab === 'inbox' && (
        <InboxPanel
          inbox={inbox} selectedKey={selectedConversationKey} onSelect={setSelectedConversationKey}
          conversationMessages={conversationMessages} replyForm={replyForm} setReplyForm={setReplyForm}
          onSend={handleReplySend} saving={saving} isBaileys={false} templates={templates}
        />
      )}
      {!useBaileys && tab === 'rules' && (
        <>
          <CollectionSection title="Auto Reply Rules"
            subtitle="Rules trigger after customer message is stored by webhook."
            rows={officialRuleRows}
            onAdd={() => { setEditingRule(null); setRuleForm(emptyRule); setRuleOpen(true); }}>
            <Card><CardContent>
              <Typography fontWeight={700}>Webhook setup</Typography>
              <Typography variant="body2" color="text.secondary">
                Meta webhook URL: <strong>/api/whatsapp/webhook</strong>.
              </Typography>
            </CardContent></Card>
          </CollectionSection>
          <RuleDialog open={ruleOpen} onClose={() => setRuleOpen(false)}
            editing={editingRule} form={ruleForm} setForm={setRuleForm}
            onSave={handleSaveRule} saving={saving} isBaileys={false} />
        </>
      )}
      {!useBaileys && tab === 'send' && (
        <QuickSendPanel onSend={handleQuickSend} saving={saving} isBaileys={false} templates={templates} />
      )}
      {!useBaileys && tab === 'invite' && (
        <InvitationPanel
          isBaileys={false}
          invitationForm={invitationForm}         setInvitationForm={setInvitationForm}
          selectedRecipients={selectedRecipients} setSelectedRecipients={setSelectedRecipients}
          fontStyle={fontStyle}                   setFontStyle={setFontStyle}
          onUploadImage={handleUploadImage}       uploadingImage={uploadingImage}
          sendServiceFn={whatsappService.sendInvitation}
          fileName={fileName}                     setFileName={setFileName}
        />
      )}
      {!useBaileys && tab === 'manual'    && <ManualInvitePanel isBaileys={false} />}
      {!useBaileys && tab === 'campaigns' && <CampaignsPanel    isBaileys={false} />}
      {!useBaileys && tab === 'history'   && <BlastHistoryPanel isBaileys={false} />}
      {!useBaileys && tab === 'templates' && (
        <CollectionSection title="Templates" subtitle="Approved WhatsApp message templates." rows={templateRows} />
      )}
      {!useBaileys && tab === 'connections' && (
        <CollectionSection title="Connections" subtitle="Manual or embedded WhatsApp connection records." rows={connectionsRows} />
      )}
      {!useBaileys && tab === 'logs' && (
        <CollectionSection title="Message Logs" subtitle="Incoming webhook messages, manual replies and auto replies." rows={logRows} />
      )}
    </Box>
  );
}
