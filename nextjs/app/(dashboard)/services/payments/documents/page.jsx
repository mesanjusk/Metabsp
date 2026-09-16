'use client';

import PageBody from '@/lib/ui/app/PageBody';
import BusinessDocuments from '@/lib/ui/app/BusinessDocuments';

/** Documents were stacked under the Payments landing page; they get an address of their own. */
export default function PaymentsDocumentsPage() {
  return (
    <PageBody
      title="Documents"
      description="Quotations, invoices and receipts generated from the records in this workspace."
    >
      <BusinessDocuments />
    </PageBody>
  );
}
