'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Box, Tab, Tabs } from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';
import { useAuth } from '@/lib/ui/AuthContext';

const AdminAnalyticsPanel = dynamic(() => import('@/lib/ui/whatsappCloud/AdminAnalyticsPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});
const AdminUserManagementPanel = dynamic(() => import('@/lib/ui/whatsappCloud/AdminUserManagementPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});
const MetaWebhookConfigPanel = dynamic(() => import('@/lib/ui/whatsappCloud/MetaWebhookConfigPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

const TABS = [
  { value: 'overview', label: 'Platform overview' },
  { value: 'users', label: 'Users' },
  { value: 'meta', label: 'Meta configuration' },
];

/**
 * Platform administration.
 *
 * The client-side check below hides the screen from a non-admin who reaches
 * the URL directly; it is not the security boundary. Every endpoint these
 * panels call re-checks the caller's role server-side, which is what actually
 * enforces access.
 */
export default function AdminPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (!isAdmin) router.replace('/inbox');
  }, [isAdmin, router]);

  if (!isAdmin) return null;

  return (
    <PageBody
      title="Administration"
      description="Platform-wide health, accounts and the Meta app configuration this deployment runs against."
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_event, next) => setTab(next)} aria-label="Administration section">
          {TABS.map((entry) => (
            <Tab key={entry.value} value={entry.value} label={entry.label} />
          ))}
        </Tabs>
      </Box>

      {tab === 'overview' ? <AdminAnalyticsPanel /> : null}
      {tab === 'users' ? <AdminUserManagementPanel /> : null}
      {tab === 'meta' ? <MetaWebhookConfigPanel /> : null}
    </PageBody>
  );
}
