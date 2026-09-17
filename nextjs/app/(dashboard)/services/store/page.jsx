'use client';

import PageBody from '@/lib/ui/app/PageBody';
import StoreOverview from '@/lib/ui/store/StoreOverview';

export default function StoreServicePage() {
  return (
    <PageBody
      title="E-Store"
      description="Run your catalogue and customer enquiries from one place."
    >
      <StoreOverview />
    </PageBody>
  );
}
