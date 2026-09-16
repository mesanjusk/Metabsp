'use client';

import PageBody from '@/lib/ui/app/PageBody';
import SmbOverview from '@/lib/ui/smb/SmbOverview';

export default function PaymentsServicePage() {
  return (
    <PageBody
      title="Payments & Documents"
      description="Where the money stands this month. Quotations, orders, payments, expenses and documents each have a screen in the menu on the left."
    >
      <SmbOverview service="payments" />
    </PageBody>
  );
}
