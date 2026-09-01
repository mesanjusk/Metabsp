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
 * `isAdmin` comes from the server now (see lib/ui/AuthContext.jsx), not from a
 * value in browser storage that the visitor could set. It is false until
 * /api/users/me answers, which is why the redirect waits for
 * `isIdentityLoading` to clear — otherwise every admin would be bounced to the
 * inbox during the moment before their own role is confirmed.
 *
 * This is still presentation, not the security boundary: every endpoint these
 * panels call re-checks the caller's role with requireAdmin. Both halves are
 * needed — the server one to protect the data, this one so a non-admin is
 * never shown a screen full of controls that will only ever return 403.
 */
export default function AdminPage() {
  const { isAdmin, isIdentityLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (!isIdentityLoading && !isAdmin) router.replace('/inbox');
  }, [isAdmin, isIdentityLoading, router]);

  if (isIdentityLoading) {
    return (
      <PageBody title="Administration">
        <LoadingSkeleton />
      </PageBody>
    );
  }

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
