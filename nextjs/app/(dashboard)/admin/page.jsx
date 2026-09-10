'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Box, Stack, Tab, Tabs } from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';
import { useAuth } from '@/lib/ui/AuthContext';

const AdminAnalyticsPanel = dynamic(() => import('@/lib/ui/whatsappCloud/AdminAnalyticsPanel'), { ssr: false, loading: () => <LoadingSkeleton /> });
const AdminUserManagementPanel = dynamic(() => import('@/lib/ui/whatsappCloud/AdminUserManagementPanel'), { ssr: false, loading: () => <LoadingSkeleton /> });
const AdminServiceAccessPanel = dynamic(() => import('@/lib/ui/app/AdminServiceAccessPanel'), { ssr: false, loading: () => <LoadingSkeleton /> });
const MetaWebhookConfigPanel = dynamic(() => import('@/lib/ui/whatsappCloud/MetaWebhookConfigPanel'), { ssr: false, loading: () => <LoadingSkeleton /> });
const WebhookDeliveryPanel = dynamic(() => import('@/lib/ui/whatsappCloud/WebhookDeliveryPanel'), { ssr: false, loading: () => <LoadingSkeleton /> });
const WhatsAppAccountsAdminPanel = dynamic(() => import('@/lib/ui/whatsappCloud/WhatsAppAccountsAdminPanel'), { ssr: false, loading: () => <LoadingSkeleton /> });

const TABS = [
  { value: 'overview', label: 'Platform overview' },
  { value: 'users', label: 'Users' },
  { value: 'services', label: 'Service access' },
  { value: 'meta', label: 'Meta configuration' },
];

export default function AdminPage() {
  const { isAdmin, isIdentityLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (!isIdentityLoading && !isAdmin) router.replace('/home');
  }, [isAdmin, isIdentityLoading, router]);

  if (isIdentityLoading) {
    return <PageBody title="Administration"><LoadingSkeleton /></PageBody>;
  }
  if (!isAdmin) return null;

  return (
    <PageBody title="Administration" description="Manage customers, service access, platform health and Meta configuration.">
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, overflowX: 'auto' }}>
        <Tabs value={tab} onChange={(_event, next) => setTab(next)} aria-label="Administration section" variant="scrollable" scrollButtons="auto">
          {TABS.map((entry) => <Tab key={entry.value} value={entry.value} label={entry.label} />)}
        </Tabs>
      </Box>

      {tab === 'overview' ? <AdminAnalyticsPanel /> : null}
      {tab === 'users' ? <AdminUserManagementPanel /> : null}
      {tab === 'services' ? <AdminServiceAccessPanel /> : null}
      {tab === 'meta' ? (
        <Stack spacing={3}>
          <MetaWebhookConfigPanel />
          <WebhookDeliveryPanel />
          <WhatsAppAccountsAdminPanel />
        </Stack>
      ) : null}
    </PageBody>
  );
}
