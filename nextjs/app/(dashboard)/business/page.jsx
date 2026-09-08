'use client';

import dynamic from 'next/dynamic';
import PageBody from '@/lib/ui/app/PageBody';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

const BusinessToolsPanel = dynamic(() => import('@/lib/ui/whatsappCloud/BusinessToolsPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

export default function BusinessToolsPage() {
  return (
    <PageBody
      title="WhatsApp business tools"
      description="Manage the WhatsApp business profile, catalogue/cart settings, click-to-chat QR codes and WhatsApp Flows for your active number."
    >
      <BusinessToolsPanel />
    </PageBody>
  );
}
