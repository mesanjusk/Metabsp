'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import apiClient from '@/lib/api/client';

const money = (paise) => `₹${Math.round(Number(paise || 0) / 100).toLocaleString('en-IN')}`;
const EMPTY = { title: '', customerName: '', customerPhone: '', amount: '', balance: '', reference: '', dueAt: '', hsnSac: '', gstRate: '', sellerGstin: '', customerGstin: '', placeOfSupply: '' };

export default function BusinessDocuments() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    setLoading(true); setError('');
    try { const response = await apiClient.get('/api/smb/records', { params: { kind: 'quotation,order,invoice,payment', limit: 150 } }); setRecords(response?.data?.data || []); }
    catch (requestError) { setError(requestError?.response?.data?.message || 'Could not load business documents.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const createInvoice = async () => {
    if (!form.title.trim()) return;
    setSaving(true); setError('');
    try {
      await apiClient.post('/api/smb/records', {
        kind: 'invoice', title: form.title.trim(), customerName: form.customerName.trim(), customerPhone: form.customerPhone.trim(),
        amount: Number(form.amount || 0), balance: form.balance === '' ? Number(form.amount || 0) : Number(form.balance || 0),
        reference: form.reference.trim(), dueAt: form.dueAt || undefined, status: 'open', source: 'payments',
        data: {
          hsnSac: form.hsnSac.trim(), gstRate: form.gstRate === '' ? '' : Number(form.gstRate), sellerGstin: form.sellerGstin.trim().toUpperCase(),
          customerGstin: form.customerGstin.trim().toUpperCase(), placeOfSupply: form.placeOfSupply.trim(), taxInclusive: true,
        },
      });
      setForm(EMPTY); setShowForm(false); setNotice('Customer invoice created.'); await load();
    } catch (requestError) { setError(requestError?.response?.data?.message || 'Could not create customer invoice.'); }
    finally { setSaving(false); }
  };

  const printRecord = async (record) => {
    setError('');
    const preview = window.open('', '_blank');
    if (!preview) { setError('Pop-up was blocked. Allow pop-ups for this dashboard and try again.'); return; }
    preview.opener = null;
    preview.document.write('<p style="font-family:Arial;padding:24px">Preparing document…</p>');
    try {
      const response = await apiClient.get(`/api/smb/records/${record._id}/document`, { responseType: 'text' });
      preview.document.open(); preview.document.write(response.data); preview.document.close();
    } catch (requestError) {
      preview.close(); setError(requestError?.response?.data?.message || 'Could not prepare the document.');
    }
  };

  return <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}><Box><Typography variant="h6" fontWeight={800}>Business documents</Typography><Typography variant="body2" color="text.secondary">Create invoices with optional GST/HSN details and print/save quotations, orders, invoices and payment receipts.</Typography></Box><Stack direction="row" spacing={1}><Button size="small" startIcon={<RefreshRoundedIcon />} onClick={load} disabled={loading}>Refresh</Button><Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setShowForm((value) => !value)}>Invoice</Button></Stack></Stack>
    {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert> : null}{notice ? <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert> : null}
    {showForm ? <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(3,minmax(0,1fr))' }, gap: 1.25 }}>
      <TextField size="small" label="Invoice title / purpose" value={form.title} onChange={update('title')} required /><TextField size="small" label="Customer name" value={form.customerName} onChange={update('customerName')} /><TextField size="small" label="Customer phone" value={form.customerPhone} onChange={update('customerPhone')} />
      <TextField size="small" type="number" label="Invoice total incl. GST (₹)" value={form.amount} onChange={update('amount')} /><TextField size="small" type="number" label="Balance due (₹)" value={form.balance} onChange={update('balance')} /><TextField size="small" label="Invoice reference" value={form.reference} onChange={update('reference')} />
      <TextField size="small" type="datetime-local" label="Due date" value={form.dueAt} onChange={update('dueAt')} InputLabelProps={{ shrink: true }} /><TextField size="small" label="HSN / SAC" value={form.hsnSac} onChange={update('hsnSac')} /><TextField size="small" type="number" label="GST rate (%)" value={form.gstRate} onChange={update('gstRate')} />
      <TextField size="small" label="Your GSTIN" value={form.sellerGstin} onChange={update('sellerGstin')} /><TextField size="small" label="Customer GSTIN" value={form.customerGstin} onChange={update('customerGstin')} /><TextField size="small" label="Place of supply" value={form.placeOfSupply} onChange={update('placeOfSupply')} />
    </Box><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>GST fields are optional. When a GST rate is entered, the printable invoice splits the entered total into taxable value and GST while keeping the saved total unchanged.</Typography><Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}><Button onClick={() => setShowForm(false)}>Cancel</Button><Button variant="contained" onClick={createInvoice} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : 'Create invoice'}</Button></Stack></Paper> : null}
    {loading ? <Stack direction="row" justifyContent="center" spacing={1} sx={{ py: 4 }}><CircularProgress size={20} /><Typography variant="body2">Loading…</Typography></Stack> : records.length ? <Stack>{records.map((record) => <Stack key={record._id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ sm: 'center' }} sx={{ py: 1.4, borderBottom: '1px solid', borderColor: 'divider' }}><Box sx={{ minWidth: 0, flex: 1 }}><Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}><Typography variant="body2" fontWeight={800}>{record.title}</Typography><Chip size="small" label={String(record.kind || '').replace('_', ' ')} /><Chip size="small" label={record.status || 'open'} variant="outlined" />{record.data?.gstRate !== undefined && record.data?.gstRate !== '' ? <Chip size="small" label={`GST ${record.data.gstRate}%`} /> : null}</Stack><Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.35 }}>{[record.contactId?.name || record.contactId?.phone, record.reference ? `Ref: ${record.reference}` : '', record.data?.hsnSac ? `HSN/SAC: ${record.data.hsnSac}` : '', record.dueAt ? `Due: ${new Date(record.dueAt).toLocaleDateString('en-IN')}` : ''].filter(Boolean).join(' · ') || 'No customer/reference assigned'}</Typography></Box><Stack direction="row" spacing={1} alignItems="center"><Typography variant="body2" fontWeight={800}>{money(record.amountInPaise)}</Typography>{record.balanceInPaise ? <Chip size="small" label={`${money(record.balanceInPaise)} due`} /> : null}<Button size="small" startIcon={<PrintRoundedIcon />} onClick={() => printRecord(record)}>Print</Button></Stack></Stack>)}</Stack> : <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No printable business documents yet.</Typography>}
  </CardContent></Card>;
}
