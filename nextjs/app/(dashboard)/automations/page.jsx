'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, Tab, Tabs } from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import { useDashboardSearch } from '@/lib/ui/app/DashboardContext';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

const AutoReplyManagementPanel = dynamic(() => import('@/lib/ui/whatsappCloud/AutoReplyManagementPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});
const WorkflowManagementPanel = dynamic(() => import('@/lib/ui/whatsappCloud/WorkflowManagementPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

// Auto-replies and workflows are the same job at two levels of complexity —
// "answer this keyword" and "run these steps" — so they belong on one page as
// tabs, not as two sibling entries competing in the sidebar.
const TABS = [
  { value: 'auto-reply', label: 'Auto replies', search: 'Search auto replies' },
  { value: 'workflows', label: 'Workflows', search: 'Search workflows' },
];

export default function AutomationsPage() {
  const [tab, setTab] = useState('auto-reply');
  const active = TABS.find((entry) => entry.value === tab) || TABS[0];
  const { search } = useDashboardSearch(active.search);

  return (
    <PageBody
      title="Automations"
      description="Reply to customers without anyone watching the inbox. Keyword auto-replies answer a single message; workflows run a sequence of steps with delays between them."
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_event, next) => setTab(next)} aria-label="Automation type">
          {TABS.map((entry) => (
            <Tab key={entry.value} value={entry.value} label={entry.label} />
          ))}
        </Tabs>
      </Box>

      {tab === 'auto-reply' ? (
        <AutoReplyManagementPanel search={search} />
      ) : (
        <WorkflowManagementPanel search={search} />
      )}
    </PageBody>
  );
}
