'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

const COLUMNS = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];
const CLOSED = new Set(['completed', 'paid', 'done', 'closed']);
const money = (paise) => `₹${Math.round(Number(paise || 0) / 100).toLocaleString('en-IN')}`;

function normalizedStatus(record) {
  const status = String(record?.status || 'open').toLowerCase();
  if (CLOSED.has(status)) return 'completed';
  if (['in_progress', 'processing', 'working', 'confirmed'].includes(status)) return 'in_progress';
  return 'open';
}

export default function CrmOrderBoardPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await apiClient.get('/api/smb/records', { params: { kind: 'order', limit: 250 } });
      setOrders(response?.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load the order board.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => Object.fromEntries(COLUMNS.map((column) => [column.key, orders.filter((order) => normalizedStatus(order) === column.key)])), [orders]);

  const move = async (order, status) => {
    setSavingId(order._id); setError('');
    try {
      await apiClient.patch(`/api/smb/records/${order._id}`, { status });
      await load();
    } catch (e) { setError(e?.response?.data?.message || 'Could not update the order.'); }
    finally { setSavingId(''); }
  };

  return (
    <PageBody title="Order / Job board" description="See confirmed work by status and move jobs forward without opening each record.">
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="flex-end"><Button startIcon={<RefreshRoundedIcon />} onClick={load}>Refresh</Button></Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? <Stack direction="row" spacing={1} justifyContent="center" sx={{ py: 5 }}><CircularProgress size={20} /><Typography>Loading board…</Typography></Stack> : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3,minmax(0,1fr))' }, gap: 2, alignItems: 'start' }}>
            {COLUMNS.map((column, index) => (
              <Card key={column.key} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography fontWeight={800}>{column.label}</Typography><Chip size="small" label={grouped[column.key]?.length || 0} />
                </Stack>
                <Stack spacing={1.25}>
                  {(grouped[column.key] || []).map((order) => (
                    <Card key={order._id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                      <Typography variant="body2" fontWeight={750}>{order.title}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
                        {[order.contactId?.name || order.contactId?.phone, order.assignedTo ? `Owner: ${order.assignedTo}` : '', order.dueAt ? `Due: ${new Date(order.dueAt).toLocaleDateString('en-IN')}` : ''].filter(Boolean).join(' · ') || 'No details'}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 1.25 }}>
                        <Typography variant="body2" fontWeight={800}>{money(order.amountInPaise)}</Typography>
                        {index < COLUMNS.length - 1 ? <Button size="small" disabled={savingId === order._id} onClick={() => move(order, COLUMNS[index + 1].key)}>{index === 0 ? 'Start' : 'Complete'}</Button> : null}
                      </Stack>
                    </Card>
                  ))}
                  {!grouped[column.key]?.length ? <Typography variant="caption" color="text.secondary">No jobs here.</Typography> : null}
                </Stack>
              </Card>
            ))}
          </Box>
        )}
      </Stack>
    </PageBody>
  );
}
