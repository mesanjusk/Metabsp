import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Box, Button, Card, CardContent, Chip, Grid,
  MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import apiClient from '../../apiClient';
import { uploadToCloudinary } from '../../services/whatsappCloudService';

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
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; ctx.shadowBlur = 6; }
  else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
  ctx.fillText(name, x * W, y * H);
}

function parseRowsToRecipients(rows) {
  return rows.map(r => {
    const name   = String(r.Name || r.name || r.NAME || '').trim();
    const mobile = String(r.Mobile || r.mobile || r.Phone || r.phone || r.Number || r.number || '').trim();
    return { name, mobile };
  }).filter(r => r.mobile);
}

export default function ManualInvitePanel() {
  const [form, setForm] = useState({
    title: '', message: 'Hi {name}!', imageUrl: '', recipientMode: 'single',
    singleName: '', singleNumber: '',
    fontStyle: { ...emptyFontStyle },
  });
  const [recipients,     setRecipients]     = useState([]);
  const [sentSet,        setSentSet]         = useState(new Set());
  const [uploadingImage, setUploadingImage]  = useState(false);
  const [saving,         setSaving]          = useState(false);
  const [savedId,        setSavedId]         = useState(null);
  const [fileName,       setFileName]        = useState('');
  const [imageLoaded,    setImageLoaded]     = useState(false);
  const [imageError,     setImageError]      = useState('');

  const canvasRef  = useRef(null);
  const imageElRef = useRef(null);

  const loadImageFromUrl = (url, fontStyle) => {
    if (!url) { setImageLoaded(false); imageElRef.current = null; setImageError(''); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageElRef.current = img;
      setImageLoaded(true);
      setImageError('');
      setTimeout(() => {
        if (canvasRef.current) {
          canvasRef.current.width  = 300;
          canvasRef.current.height = Math.round(300 * img.naturalHeight / img.naturalWidth) || 200;
          drawNameOnCanvas(canvasRef.current, img, 'Preview', fontStyle || emptyFontStyle);
        }
      }, 0);
    };
    img.onerror = () => { imageElRef.current = null; setImageLoaded(false); setImageError('Could not load image. Try uploading directly.'); };
    img.src = url;
  };

  const handleImageUrlChange = (url) => {
    setForm(p => ({ ...p, imageUrl: url }));
    loadImageFromUrl(url, form.fontStyle);
  };

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setImageError('');
    try {
      const url = await uploadToCloudinary({ file, type: 'image' });
      setForm(p => ({ ...p, imageUrl: url }));
      loadImageFromUrl(url, form.fontStyle);
    } catch (err) {
      setImageError('Image upload failed: ' + err.message);
    } finally { setUploadingImage(false); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const buffer   = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const rows     = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    setRecipients(parseRowsToRecipients(rows).map(r => ({ ...r, checked: true })));
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
        fontStyle: form.fontStyle,
        recipients: effectiveRecipients.map((r, i) => ({
          name: r.name, mobile: r.mobile,
          waUrl: buildWaUrl(r.name, r.mobile),
          status: sentSet.has(i) ? 'SENT' : 'PENDING',
        })),
        sentCount:   [...sentSet].length,
        failedCount: 0,
      };
      const res = await apiClient.post('/api/whatsapp/campaigns', payload);
      setSavedId(res.data._id);
    } catch (e) {
      console.error('[manual] save error:', e.message);
    } finally { setSaving(false); }
  };

  const updateFontStyle = (key, val) => {
    setForm(p => {
      const fs = { ...p.fontStyle, [key]: val };
      if (imageLoaded && canvasRef.current && imageElRef.current) {
        drawNameOnCanvas(canvasRef.current, imageElRef.current, 'Preview', fs);
      }
      return { ...p, fontStyle: fs };
    });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Card><CardContent>
        <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>Manual wa.me Generator</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Generate wa.me links for each recipient. Click to open WhatsApp with a pre-filled message. Works without a Cloud API connection.
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

          {/* Image section */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Image (optional)</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={uploadingImage}>
                {uploadingImage ? 'Uploading…' : 'Upload Image'}
                <input type="file" hidden accept="image/*" onChange={handleUploadImage} />
              </Button>
              <TextField
                size="small"
                label="Or paste image URL"
                value={form.imageUrl}
                onChange={e => handleImageUrlChange(e.target.value)}
                sx={{ flex: 1, minWidth: 200 }}
              />
            </Stack>
            {imageError && <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>{imageError}</Typography>}
            {imageLoaded && (
              <Box sx={{ mt: 1.5 }}>
                <canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: 8 }} />
                <Box sx={{ mt: 1 }}>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    <TextField select size="small" label="Font Family" value={form.fontStyle.fontFamily}
                      onChange={e => updateFontStyle('fontFamily', e.target.value)} sx={{ width: 140 }}>
                      {['serif','sans-serif','monospace','cursive','fantasy'].map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                    </TextField>
                    <TextField size="small" type="number" label="Font Size" value={form.fontStyle.fontSize}
                      onChange={e => updateFontStyle('fontSize', Number(e.target.value))} sx={{ width: 100 }} />
                    <TextField select size="small" label="Weight" value={form.fontStyle.fontWeight}
                      onChange={e => updateFontStyle('fontWeight', e.target.value)} sx={{ width: 110 }}>
                      {['normal','bold','800'].map(w => <MenuItem key={w} value={w}>{w}</MenuItem>)}
                    </TextField>
                    <TextField size="small" type="color" label="Color" value={form.fontStyle.color}
                      onChange={e => updateFontStyle('color', e.target.value)} sx={{ width: 80 }} />
                    <TextField select size="small" label="Align" value={form.fontStyle.textAlign}
                      onChange={e => updateFontStyle('textAlign', e.target.value)} sx={{ width: 100 }}>
                      {['left','center','right'].map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Shadow" value={form.fontStyle.shadow ? 'yes' : 'no'}
                      onChange={e => updateFontStyle('shadow', e.target.value === 'yes')} sx={{ width: 90 }}>
                      <MenuItem value="yes">Yes</MenuItem>
                      <MenuItem value="no">No</MenuItem>
                    </TextField>
                  </Stack>
                  <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
                    <TextField size="small" type="number" inputProps={{ min: 0, max: 1, step: 0.05 }} label="X pos (0–1)"
                      value={form.fontStyle.x} onChange={e => updateFontStyle('x', Number(e.target.value))} sx={{ width: 120 }} />
                    <TextField size="small" type="number" inputProps={{ min: 0, max: 1, step: 0.05 }} label="Y pos (0–1)"
                      value={form.fontStyle.y} onChange={e => updateFontStyle('y', Number(e.target.value))} sx={{ width: 120 }} />
                  </Stack>
                </Box>
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
                            color={sent ? 'success' : 'primary'}
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
                variant="contained"
                color="secondary"
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
    </Box>
  );
}
