'use client';

import dynamic from 'next/dynamic';
import PageBody from '@/lib/ui/app/PageBody';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

const AnalyticsDashboard = dynamic(() => import('@/lib/ui/whatsappCloud/AnalyticsDashboard'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

export default function AnalyticsPage() {
  return (
    <PageBody
      title="Analytics"
      description="Message volume, delivery and conversation activity across your connected numbers."
    >
      <AnalyticsDashboard />
    </PageBody>
  );
}
