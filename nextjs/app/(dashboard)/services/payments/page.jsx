'use client';

import { Stack } from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import SmallBusinessWorkspace from '@/lib/ui/app/SmallBusinessWorkspace';
import BusinessDocuments from '@/lib/ui/app/BusinessDocuments';

export default function PaymentsServicePage() {
  return (
    <PageBody title="Payments & Documents" description="Track quotations, orders, customer invoices, collections, balances and expenses from the same customer history.">
      <Stack spacing={2.5}>
        <SmallBusinessWorkspace service="payments" />
        <BusinessDocuments />
      </Stack>
    </PageBody>
  );
}
