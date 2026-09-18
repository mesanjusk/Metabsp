'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { Alert, Box, Button, Card, CircularProgress, Stack, Typography } from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

const money = (paise) => `₹${Math.round(Number(paise || 0) / 100).toLocaleString('en-IN')}`;

export default function PaymentsReportsPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    apiClient.get('/api/smb/summary').then((r) => setSummary(r?.data?.data || {})).catch((e) => setError(e?.response?.data?.message || 'Could not load reports.'));
  }, []);

  const aging = summary?.aging || {};
  const cards = [
    ['Outstanding', summary?.outstandingPaise],
    ['Not yet due', aging.currentPaise],
    ['1–30 days overdue', aging.days1to30Paise],
    ['31–60 days overdue', aging.days31to60Paise],
    ['61+ days / no due date', aging.days61PlusPaise],
  ];

  return (
    <PageBody title="Collections & reports" description="Outstanding balances, aging, payment reminders and purchasing activity in one place.">
      <Stack spacing={2.5}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {!summary && !error ? <Stack direction="row" justifyContent="center" spacing={1} sx={{ py: 5 }}><CircularProgress size={20} /><Typography>Loading reports…</Typography></Stack> : null}
        {summary ? <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', lg: 'repeat(5,minmax(0,1fr))' }, gap: 1.5 }}>
            {cards.map(([label, value]) => <Card key={label} variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography><Typography sx={{ mt: 0.5, fontSize: '1.5rem', fontWeight: 800 }}>{money(value)}</Typography></Card>)}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3,minmax(0,1fr))' }, gap: 1.5 }}>
            <Card variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}><Typography fontWeight={800}>Payment reminders</Typography><Typography variant="h4" sx={{ my: 1 }}>{summary.paymentRemindersOpen || 0}</Typography><Button component={NextLink} href="/services/payments/records/payment_reminder">Open reminders</Button></Card>
            <Card variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}><Typography fontWeight={800}>Purchase orders</Typography><Typography variant="h4" sx={{ my: 1 }}>{summary.purchaseOrdersOpen || 0}</Typography><Button component={NextLink} href="/services/payments/records/purchase_order">Open POs</Button></Card>
            <Card variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}><Typography fontWeight={800}>Active rate cards</Typography><Typography variant="h4" sx={{ my: 1 }}>{summary.rateCardsActive || 0}</Typography><Button component={NextLink} href="/services/payments/records/rate_card">Open rate cards</Button></Card>
          </Box>
        </> : null}
      </Stack>
    </PageBody>
  );
}
