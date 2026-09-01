'use client';

import dynamic from 'next/dynamic';
import PageBody from '@/lib/ui/app/PageBody';
import { useDashboardSearch } from '@/lib/ui/app/DashboardContext';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

const CRMPanel = dynamic(() => import('@/lib/ui/whatsappCloud/CRMPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

export default function ContactsPage() {
  const { search } = useDashboardSearch('Search contacts');

  return (
    <PageBody
      title="Contacts"
      description="Everyone who has messaged your business, plus anyone you have imported. Tag and segment them here, then send to a segment from Broadcasts."
    >
      <CRMPanel search={search} />
    </PageBody>
  );
}
