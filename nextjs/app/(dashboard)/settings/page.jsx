'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, Tab, Tabs } from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

const WorkspacePreferencesPanel = dynamic(() => import('@/lib/ui/whatsappCloud/WorkspacePreferencesPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});
const TeamManagementPanel = dynamic(() => import('@/lib/ui/whatsappCloud/TeamManagementPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});
const BillingPanel = dynamic(() => import('@/lib/ui/whatsappCloud/BillingPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

const TABS = [
  { value: 'workspace', label: 'Workspace' },
  { value: 'team', label: 'Team' },
  { value: 'billing', label: 'Plan & usage' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState('workspace');

  return (
    <PageBody title="Settings" description="How this workspace behaves, who can use it, and what it costs.">
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_event, next) => setTab(next)} aria-label="Settings section">
          {TABS.map((entry) => (
            <Tab key={entry.value} value={entry.value} label={entry.label} />
          ))}
        </Tabs>
      </Box>

      {tab === 'workspace' ? <WorkspacePreferencesPanel /> : null}
      {tab === 'team' ? <TeamManagementPanel /> : null}
      {tab === 'billing' ? <BillingPanel /> : null}
    </PageBody>
  );
}
