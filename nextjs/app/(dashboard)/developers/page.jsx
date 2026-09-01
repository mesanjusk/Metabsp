'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import NextLink from 'next/link';
import { Box, Button, Stack, Tab, Tabs } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PageBody from '@/lib/ui/app/PageBody';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

const ApiKeysPanel = dynamic(() => import('@/lib/ui/whatsappCloud/ApiKeysPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});
const WebhookDestinationsPanel = dynamic(() => import('@/lib/ui/whatsappCloud/WebhookDestinationsPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});
const ApiReferencePanel = dynamic(() => import('@/lib/ui/whatsappCloud/ApiReferencePanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

/**
 * Everything an integrator needs, in one place: how to send, how to receive, a
 * key to authenticate with, and the destinations that push events into their
 * own systems.
 *
 * Both halves were previously missing or buried — API keys had no screen at
 * all, webhook destinations sat three sections deep inside a settings panel,
 * and receiving messages was documented nowhere a developer would look, even
 * though it is the question integrators ask first.
 */
const TABS = [
  { value: 'reference', label: 'API reference' },
  { value: 'keys', label: 'API keys' },
  { value: 'webhooks', label: 'Webhook destinations' },
];

export default function DevelopersPage() {
  const [tab, setTab] = useState('reference');

  return (
    <PageBody
      title="Developers"
      description="Send messages from your own systems, and receive every inbound message into them — by signed webhook, or by polling if you cannot host an endpoint."
      actions={
        <Button
          component={NextLink}
          href="/developer-docs"
          target="_blank"
          rel="noopener"
          variant="outlined"
          endIcon={<OpenInNewRoundedIcon fontSize="small" />}
        >
          Public docs
        </Button>
      }
    >
      <Stack spacing={3}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_event, next) => setTab(next)} aria-label="Developer settings">
            {TABS.map((entry) => (
              <Tab key={entry.value} value={entry.value} label={entry.label} />
            ))}
          </Tabs>
        </Box>

        {tab === 'reference' ? <ApiReferencePanel /> : null}
        {tab === 'keys' ? <ApiKeysPanel /> : null}
        {tab === 'webhooks' ? <WebhookDestinationsPanel /> : null}
      </Stack>
    </PageBody>
  );
}
