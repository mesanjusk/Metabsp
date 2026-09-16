'use client';

import PageBody from '@/lib/ui/app/PageBody';
import SmbOverview from '@/lib/ui/smb/SmbOverview';

export default function StoreServicePage() {
  return (
    <PageBody
      title="Mini Store"
      description="How the catalogue and stock are doing. Products, inventory and review requests each have a screen in the menu on the left."
    >
      <SmbOverview service="store" />
    </PageBody>
  );
}
