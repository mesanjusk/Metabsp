'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

const CLOSED = new Set(['completed', 'done', 'closed', 'cancelled']);

export default function StaffMyDayPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await apiClient.get('/api/smb/records', { params: { kind: 'task,sop_task,followup', limit: 250 } });
      setRecords(response?.data?.data || []);
    } catch (e) { setError(e?.response?.data?.message || 'Could not load My Day.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const todayEnd = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }, []);
  const due = records.filter((item) => !CLOSED.has(item.status) && item.dueAt && new Date(item.dueAt) <= todayEnd);
  const overdue = due.filter((item) => new Date(item.dueAt) < new Date(new Date().setHours(0, 0, 0, 0)));

  const done = async (item) => {
    setSaving(item._id); setError('');
    try { await apiClient.patch(`/api/smb/records/${item._id}`, { status: 'completed' }); await load(); }
    catch (e) { setError(e?.response?.data?.message || 'Could not update this item.'); }
    finally { setSaving(''); }
  };

  return (
    <PageBody title="My Day" description="Tasks, SOP actions and customer follow-ups due today or already overdue.">
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center"><Stack direction="row" spacing={1}><Chip label={`${due.length} due`} /><Chip color={overdue.length ? 'warning' : 'default'} label={`${overdue.length} overdue`} /></Stack><Button startIcon={<RefreshRoundedIcon />} onClick={load}>Refresh</Button></Stack>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? <Stack direction="row" justifyContent="center" spacing={1} sx={{ py: 5 }}><CircularProgress size={20} /><Typography>Loading…</Typography></Stack> : due.length ? (
          <Box sx={{ display: 'grid', gap: 1.25 }}>
            {due.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)).map((item) => (
              <Card key={item._id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ sm: 'center' }}>
                  <Box minWidth={0}><Stack direction="row" spacing={1} flexWrap="wrap"><Typography variant="body2" fontWeight={800}>{item.title}</Typography><Chip size="small" label={String(item.kind).replace('_', ' ')} /></Stack><Typography variant="caption" color="text.secondary">{[item.assignedTo ? `Owner: ${item.assignedTo}` : '', item.contactId?.name || item.contactId?.phone || '', `Due: ${new Date(item.dueAt).toLocaleString('en-IN')}`].filter(Boolean).join(' · ')}</Typography></Box>
                  <Button size="small" startIcon={<CheckCircleRoundedIcon />} disabled={saving === item._id} onClick={() => done(item)}>Done</Button>
                </Stack>
              </Card>
            ))}
          </Box>
        ) : <Alert severity="success">Nothing due today.</Alert>}
      </Stack>
    </PageBody>
  );
}
