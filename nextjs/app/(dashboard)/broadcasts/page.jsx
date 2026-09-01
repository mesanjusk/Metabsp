'use client';

import dynamic from 'next/dynamic';
import PageBody from '@/lib/ui/app/PageBody';
import { useDashboardSearch } from '@/lib/ui/app/DashboardContext';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

const BulkSender = dynamic(() => import('@/lib/ui/whatsappCloud/BulkSender'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

export default function BroadcastsPage() {
  const { search } = useDashboardSearch('Search broadcasts');

  return (
    <PageBody
      title="Broadcasts"
      description="Send an approved template to many recipients at once. Every recipient becomes its own queued job, so a failure retries on its own and Meta's per-number rate limits are respected."
    >
      <BulkSender standalone search={search} />
    </PageBody>
  );
}
