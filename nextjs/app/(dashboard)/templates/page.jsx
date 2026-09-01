'use client';

import dynamic from 'next/dynamic';
import PageBody from '@/lib/ui/app/PageBody';
import { useDashboardSearch } from '@/lib/ui/app/DashboardContext';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

const SendMessagePanel = dynamic(() => import('@/lib/ui/whatsappCloud/SendMessagePanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

export default function TemplatesPage() {
  const { search } = useDashboardSearch('Search templates');

  return (
    <PageBody
      title="Message templates"
      description="Templates are the only way to start a conversation with someone who has not messaged you in the last 24 hours. Meta reviews each one before it can be sent."
    >
      <SendMessagePanel search={search} />
    </PageBody>
  );
}
