'use client';

import PageBody from '@/lib/ui/app/PageBody';
import SmbOverview from '@/lib/ui/smb/SmbOverview';

export default function CrmServicePage() {
  return (
    <PageBody
      title="Mini CRM"
      description="How the pipeline is moving. Leads, follow-ups, quotations and orders each have a screen in the menu on the left."
    >
      <SmbOverview service="crm" />
    </PageBody>
  );
}
