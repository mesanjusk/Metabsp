import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Box, Button, Card, CardContent, Chip, Grid,
  MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';

const normalizePhone = (v) => {
  const d = String(v || '').replace(/[^\d]/g, '').trim();
  return d.length === 10 ? '91' + d : d;
};

const emptyFontStyle = { x: 0.5, y: 0.88, fontFamily: 'serif', fontSize: 48, color: '#ffffff', fontWeight: 'bold', textAlign: 'center', shadow: true };

function drawNameOnCanvas(canvas, imageEl, name, fontStyle) {
  if (!canvas || !imageEl) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(imageEl, 0, 0, W, H);
  if (!name) return;
  const { x = 0.5, y = 0.88, fontFamily = 'serif', fontSize = 48, color = '#ffffff', fontWeight = 'bold', textAlign = 'center', shadow = true } = fontStyle;
  const scaledSize = Math.round(fontSize * (W / 600));
  ctx.font = `${fontWeight} ${scaledSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'middle';
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; ctx.shadowBlur = 6; } else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
  ctx.fillText(name, x * W, y * H);
}

function parseRowsToRecipients(rows = []) {
  return rows.map(row => ({
    name: String(row.name || row.fullName || row.Name || '').trim() || 'Guest',
    mobile: normalizePhone(row.mobile || row.phone || row.number || row.Mobile || row.Phone || ''),
    source: 'FILE',
  })).filter(item => item.mobile);
}

export default function ManualInvitePanel() {
  const [form, setForm] = useState({ title: '', message: 'Hi {name}!', imageUrl: '', recipientMode: 'single', singleName: '', singleNumber: '' });
  const [recipients, setRecipients] = useState([]);
  const [sentSet, setSentSet] = useState(new Set());
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [fileName, setFileName] = useState('');
  const canvasRef = useRef(null);
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
      const { default: api } = await import('../../api');
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

  const handleMarkSent = (idx) => setSentSet(prev => { const n = new Set(prev); n.add(idx); return n; });

  const handleSaveCampaign = async () => {
    if (!effectiveRecipients.length) return;
    setSaving(true);
    try {
      const { default: whatsappService } = await import('../../services/whatsappService');
      const payload = {
        title: form.title || 'Manual Campaign', message: form.message, imageUrl: form.imageUrl,
        type: 'MANUAL', status: 'SENT',
        recipients: effectiveRecipients.map((r, i) => ({ name: r.name, mobile: r.mobile, waUrl: buildWaUrl(r.name, r.mobile), status: sentSet.has(i) ? 'SENT' : 'PENDING' })),
        sentCount: [...sentSet].length, failedCount: 0,
      };
      const res = await whatsappService.saveCampaign(payload);
      setSavedId(res.data._id);
    } catch (e) { console.error('[manual] save error:', e.message); }
    finally { setSaving(false); }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Card><CardContent>
        <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>📲 Manual wa.me Generator</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Works without any API. Click each link to open WhatsApp with a pre-filled message for each recipient.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField label="Campaign Title" fullWidth value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} sx={{ mb: 2 }} />
            <TextField label="Message (use {name} for recipient name)" fullWidth multiline minRows={3} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField select label="Recipients" fullWidth value={form.recipientMode} onChange={e => { setForm(p => ({ ...p, recipientMode: e.target.value })); setRecipients([]); }} sx={{ mb: 2 }}>
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
          <Grid item xs={12}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={uploadingImage}>
                {uploadingImage ? 'Uploading…' : 'Attach Image (optional)'}
                <input type="file" hidden accept="image/*" onChange={handleUploadImage} />
              </Button>
              {form.imageUrl && <Typography variant="body2" color="success.main">Image uploaded ✓</Typography>}
            </Stack>
            {imageLoaded && <Box sx={{ mt: 1.5 }}><canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: 8 }} /></Box>}
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
                          <Button variant="contained" size="small" component="a" href={url} target="_blank" rel="noopener noreferrer" onClick={() => handleMarkSent(idx)}>
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
              <Button variant="contained" color="secondary" disabled={saving || !effectiveRecipients.length} onClick={handleSaveCampaign}>
                {saving ? 'Saving…' : 'Save Campaign'}
              </Button>
              {savedId && <Chip label="Saved!" color="success" />}
            </Stack>
          </Box>
        )}
      </CardContent></Card>
    </Box>
  );
}
