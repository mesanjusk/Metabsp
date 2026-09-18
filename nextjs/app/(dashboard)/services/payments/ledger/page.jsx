'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, CircularProgress, Stack, Typography } from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

const money = (paise) => `₹${Math.round(Number(paise || 0) / 100).toLocaleString('en-IN')}`;

export default function CustomerLedgerPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/api/smb/records', { params: { kind: 'order,invoice,payment', limit: 250 } })
      .then((r) => setRecords(r?.data?.data || []))
      .catch((e) => setError(e?.response?.data?.message || 'Could not load the customer ledger.'))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const map = new Map();
    for (const record of records) {
      const contact = record.contactId;
      const key = contact?._id || contact?.phone || 'unassigned';
      const current = map.get(key) || { name: contact?.name || contact?.phone || 'Unassigned / walk-in', phone: contact?.phone || '', received: 0, outstanding: 0, records: 0 };
      current.records += 1;
      if (record.kind === 'payment') current.received += Number(record.amountInPaise || 0);
      if (['order', 'invoice'].includes(record.kind)) current.outstanding += Number(record.balanceInPaise || 0);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));
  }, [records]);

  return (
    <PageBody title="Customer ledger" description="A simple collection ledger showing money received and open balances by customer. This is operational, not a statutory accounting ledger.">
      <Stack spacing={1.5}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? <Stack direction="row" justifyContent="center" spacing={1} sx={{ py: 5 }}><CircularProgress size={20} /><Typography>Loading ledger…</Typography></Stack> : rows.length ? rows.map((row) => (
          <Card key={`${row.name}-${row.phone}`} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ sm: 'center' }}>
              <div><Typography variant="body2" fontWeight={800}>{row.name}</Typography><Typography variant="caption" color="text.secondary">{[row.phone, `${row.records} records`].filter(Boolean).join(' · ')}</Typography></div>
              <Stack direction="row" spacing={3}><div><Typography variant="caption" color="text.secondary">Received</Typography><Typography fontWeight={800}>{money(row.received)}</Typography></div><div><Typography variant="caption" color="text.secondary">Outstanding</Typography><Typography fontWeight={800}>{money(row.outstanding)}</Typography></div></Stack>
            </Stack>
          </Card>
        )) : <Alert severity="info">No customer financial activity yet.</Alert>}
      </Stack>
    </PageBody>
  );
}
