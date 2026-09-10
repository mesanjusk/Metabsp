'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, Tab, Tabs } from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

const AccountProfilePanel = dynamic(() => import('@/lib/ui/whatsappCloud/AccountProfilePanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});
const WorkspacePreferencesPanel = dynamic(() => import('@/lib/ui/whatsappCloud/WorkspacePreferencesPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});
const TeamManagementPanel = dynamic(() => import('@/lib/ui/whatsappCloud/TeamManagementPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});
const AttendancePanel = dynamic(() => import('@/lib/ui/whatsappCloud/AttendancePanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});
const BillingPanel = dynamic(() => import('@/lib/ui/whatsappCloud/BillingPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

const TABS = [
  { value: 'account', label: 'Account' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'team', label: 'Team' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'billing', label: 'Plan & usage' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState('account');

  return (
    <PageBody title="Settings" description="Your account, workspace preferences, team access, attendance, and plan.">
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_event, next) => setTab(next)} aria-label="Settings section" variant="scrollable" scrollButtons="auto">
          {TABS.map((entry) => (
            <Tab key={entry.value} value={entry.value} label={entry.label} />
          ))}
        </Tabs>
      </Box>

      {tab === 'account' ? <AccountProfilePanel /> : null}
      {tab === 'workspace' ? <WorkspacePreferencesPanel /> : null}
      {tab === 'team' ? <TeamManagementPanel /> : null}
      {tab === 'attendance' ? <AttendancePanel /> : null}
      {tab === 'billing' ? <BillingPanel /> : null}
    </PageBody>
  );
}
