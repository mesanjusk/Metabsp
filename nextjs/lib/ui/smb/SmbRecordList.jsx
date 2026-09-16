'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import apiClient from '@/lib/api/client';
import { SMB_KINDS, getSmbService, smbRecordHref } from '@/lib/smb/workspaceRegistry';

const DEFAULT_STATUS = { payment: 'received', product: 'active', inventory: 'recorded', vendor: 'active', review_request: 'pending' };
const FINAL_STATUS = { lead: 'completed', followup: 'completed', quotation: 'completed', order: 'completed', payment: 'paid', expense: 'paid', task: 'completed', review_request: 'completed' };
const TERMINAL = new Set(['completed', 'paid', 'done', 'closed', 'cancelled', 'lost', 'rejected', 'active', 'recorded', 'received']);
const NEXT = { lead: 'followup', followup: 'quotation', quotation: 'order', order: 'invoice' };
const money = (paise) => `₹${Math.round(Number(paise || 0) / 100).toLocaleString('en-IN')}`;
const isMoneyKind = (kind) => ['quotation', 'order', 'payment', 'expense'].includes(kind);
const kindLabel = (kind) => SMB_KINDS[kind]?.label || kind;

const EMPTY_FORM = { title: '', customerName: '', customerPhone: '', assignedTo: '', amount: '', balance: '', dueAt: '', reference: '', quantity: '', status: '' };

/**
 * One record kind, on its own screen.
 *
 * This was a tab inside the service's landing page, which meant every kind shared a URL and the
 * service had no room left for an overview. The behaviour — create, complete, convert to the next
 * stage — is unchanged; only its address is.
 *
 * `service` is passed so "convert to the next stage" can send you to the screen the new record
 * landed on, which a tab used to do by switching itself.
 */
export default function SmbRecordList({ service, kind }) {
  const router = useRouter();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/smb/records', { params: { kind, limit: 150 } });
      setRecords(response?.data?.data || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not load these records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); setShowForm(false); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateForm = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const create = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/api/smb/records', {
        kind,
        title: form.title.trim(),
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        assignedTo: form.assignedTo.trim(),
        amount: form.amount === '' ? undefined : Number(form.amount),
        balance: form.balance === '' ? undefined : Number(form.balance),
        quantity: form.quantity === '' ? undefined : Number(form.quantity),
        dueAt: form.dueAt || undefined,
        reference: form.reference.trim(),
        status: form.status.trim() || DEFAULT_STATUS[kind] || 'open',
        source: service,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setNotice(`${kindLabel(kind)} record saved.`);
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not save the record.');
    } finally {
      setSaving(false);
    }
  };

  const finish = async (record) => {
    if (!FINAL_STATUS[record.kind]) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.patch(`/api/smb/records/${record._id}`, { status: FINAL_STATUS[record.kind] });
      setNotice('Record updated.');
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not update the record.');
    } finally {
      setSaving(false);
    }
  };

  const convert = async (record, targetKind) => {
    setSaving(true);
    setError('');
    try {
      await apiClient.post(`/api/smb/records/${record._id}/convert`, { targetKind });
      // A tab used to switch itself to where the new record landed. Do the same with the URL —
      // but only when this service actually shows that kind: an order converts to an invoice,
      // which Payments records without giving it a screen of its own.
      if (getSmbService(service)?.kinds?.includes(targetKind)) {
        router.push(smbRecordHref(service, targetKind));
        return;
      }
      setNotice(`${kindLabel(record.kind)} converted to ${kindLabel(targetKind)}.`);
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not convert the record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
      {notice ? <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert> : null}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {records.length ? `${records.length} record${records.length === 1 ? '' : 's'}` : 'No records yet'}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={load}>Refresh</Button>
              <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setShowForm((v) => !v)}>Add</Button>
            </Stack>
          </Stack>

          {showForm ? (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(3,minmax(0,1fr))' }, gap: 1.25 }}>
                <TextField size="small" label="Title / purpose" value={form.title} onChange={updateForm('title')} required />
                {!['vendor', 'product', 'inventory'].includes(kind) ? (
                  <>
                    <TextField size="small" label="Customer name" value={form.customerName} onChange={updateForm('customerName')} />
                    <TextField size="small" label="Customer phone" value={form.customerPhone} onChange={updateForm('customerPhone')} />
                  </>
                ) : null}
                <TextField size="small" label={kind === 'vendor' ? 'Vendor/contact person' : 'Assigned to'} value={form.assignedTo} onChange={updateForm('assignedTo')} />
                {isMoneyKind(kind) ? <TextField size="small" type="number" label="Amount (₹)" value={form.amount} onChange={updateForm('amount')} /> : null}
                {kind === 'order' ? <TextField size="small" type="number" label="Balance due (₹)" value={form.balance} onChange={updateForm('balance')} /> : null}
                {['product', 'inventory'].includes(kind) ? <TextField size="small" type="number" label="Quantity" value={form.quantity} onChange={updateForm('quantity')} /> : null}
                {['followup', 'quotation', 'order', 'task', 'payment', 'review_request'].includes(kind) ? (
                  <TextField size="small" type="datetime-local" label="Due / action date" value={form.dueAt} onChange={updateForm('dueAt')} InputLabelProps={{ shrink: true }} />
                ) : null}
                <TextField size="small" label="Reference" value={form.reference} onChange={updateForm('reference')} />
                <TextField size="small" select label="Status" value={form.status} onChange={updateForm('status')}>
                  <MenuItem value="">Use default</MenuItem>
                  {['open', 'pending', 'active', 'received', 'paid', 'completed', 'cancelled'].map((status) => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </TextField>
              </Box>
              <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
                <Button onClick={() => setShowForm(false)}>Cancel</Button>
                <Button variant="contained" onClick={create} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : 'Save'}</Button>
              </Stack>
            </Paper>
          ) : null}

          {loading ? (
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ py: 4 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">Loading…</Typography>
            </Stack>
          ) : records.length ? (
            <Stack>
              {records.map((record) => {
                const nextKind = NEXT[record.kind];
                return (
                  <Stack key={record._id} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={800}>{record.title}</Typography>
                        <Chip size="small" label={record.status || 'open'} variant="outlined" />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {[
                          record.contactId?.name || record.contactId?.phone,
                          record.assignedTo ? `Owner: ${record.assignedTo}` : '',
                          record.reference ? `Ref: ${record.reference}` : '',
                          record.dueAt ? `Due: ${new Date(record.dueAt).toLocaleString('en-IN')}` : '',
                        ].filter(Boolean).join(' · ') || 'No additional details'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {record.amountInPaise ? <Typography variant="body2" fontWeight={800}>{money(record.amountInPaise)}</Typography> : null}
                      {record.balanceInPaise ? <Chip size="small" label={`${money(record.balanceInPaise)} due`} /> : null}
                      {nextKind && !TERMINAL.has(record.status) ? (
                        <Button size="small" endIcon={<ArrowForwardRoundedIcon />} onClick={() => convert(record, nextKind)} disabled={saving}>
                          To {kindLabel(nextKind)}
                        </Button>
                      ) : null}
                      {FINAL_STATUS[record.kind] && !TERMINAL.has(record.status) ? (
                        <Button size="small" startIcon={<CheckCircleRoundedIcon />} onClick={() => finish(record)} disabled={saving}>Done</Button>
                      ) : null}
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No {String(kindLabel(kind)).toLowerCase()} yet.
            </Typography>
          )}
        </CardContent>
      </Card>

    </Stack>
  );
}
