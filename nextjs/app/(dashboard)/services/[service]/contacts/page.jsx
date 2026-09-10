'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import PageBody from '@/lib/ui/app/PageBody';
import { useDashboardSearch } from '@/lib/ui/app/DashboardContext';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';
import { getServiceBySlug } from '@/lib/ui/app/serviceRegistry';

const CRMPanel = dynamic(() => import('@/lib/ui/whatsappCloud/CRMPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

/**
 * Shared contacts surface mounted inside any service dashboard.
 *
 * The component and contact collection are shared. The route is namespaced by
 * service only to preserve the service-specific navigation shell.
 */
export default function SharedServiceContactsPage() {
  const params = useParams();
  const slug = Array.isArray(params?.service) ? params.service[0] : params?.service;
  const service = getServiceBySlug(slug);
  const { search } = useDashboardSearch('Search contacts');

  return (
    <PageBody
      title="Contacts"
      description={`Shared customer list${service ? ` for ${service.label}` : ''}. Import CSV or Excel once and use the same customer data across enabled services.`}
    >
      <CRMPanel search={search} />
    </PageBody>
  );
}
