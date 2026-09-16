'use client';

import dynamic from 'next/dynamic';
import PageBody from '@/lib/ui/app/PageBody';
import { useDashboardSearch } from '@/lib/ui/app/DashboardContext';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

const CRMPanel = dynamic(() => import('@/lib/ui/whatsappCloud/CRMPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

/**
 * The shared contact list, inside Institute.
 *
 * Every other service reaches this through `services/[service]/contacts`, but `services/institute`
 * is a static segment and therefore wins the match — without this file the link resolved to the
 * generic `[feature]` route with `feature=contacts`, which is not a tool, and the page answered
 * "Institute tool not found".
 */
export default function InstituteContactsPage() {
  const { search } = useDashboardSearch('Search contacts');

  return (
    <PageBody
      title="Contacts"
      description="Shared customer list for Institute Management. Students, parents and enquiries reach the same contact records the rest of the workspace uses."
    >
      <CRMPanel search={search} />
    </PageBody>
  );
}
