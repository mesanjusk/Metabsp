'use client';

import PageBody from '@/lib/ui/app/PageBody';
import SmallBusinessWorkspace from '@/lib/ui/app/SmallBusinessWorkspace';

export default function CrmServicePage() {
  return (
    <PageBody title="Mini CRM" description="One shared customer record from enquiry through follow-up, quotation and order.">
      <SmallBusinessWorkspace service="crm" />
    </PageBody>
  );
}
