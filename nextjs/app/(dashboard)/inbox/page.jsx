'use client';

import dynamic from 'next/dynamic';
import PageBody from '@/lib/ui/app/PageBody';
import { useDashboardSearch } from '@/lib/ui/app/DashboardContext';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

// The inbox is the heaviest screen in the product (conversation list, thread,
// composer, media rendering). Loading it only on this route keeps the first
// paint of every other section small.
const MessagesPanel = dynamic(() => import('@/lib/ui/whatsappCloud/MessagesPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

export default function InboxPage() {
  const { search } = useDashboardSearch('Search conversations');
  // `bleed` because this is a full-height split view: insetting it would give
  // the conversation list and the thread a shared outer scrollbar.
  return (
    <PageBody bleed>
      <MessagesPanel search={search} />
    </PageBody>
  );
}
