'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import NextLink from 'next/link';
import { Box, Button, Card, CardContent, CardHeader, Stack, Tab, Tabs, Typography } from '@mui/material';
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

const CURL_EXAMPLE = `curl https://your-domain.example/api/v1/send-template \\
  -H "Authorization: Bearer mbsp_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "919876543210",
    "template": "order_shipped",
    "language": "en_US",
    "components": []
  }'`;

/**
 * Everything an integrator needs, in one place: a key to authenticate with, a
 * working request to copy, and the webhook destinations that push events back
 * into their own systems.
 *
 * Previously the two halves were unreachable and buried respectively — API
 * keys had no screen at all, and webhook destinations sat three sections deep
 * inside a settings panel — even though both are headline features on the
 * marketing site.
 */
const TABS = [
  { value: 'keys', label: 'API keys' },
  { value: 'webhooks', label: 'Webhook destinations' },
];

export default function DevelopersPage() {
  const [tab, setTab] = useState('keys');

  return (
    <PageBody
      title="Developers"
      description="Send messages from your own systems and receive every inbound event as a signed webhook."
      actions={
        <Button
          component={NextLink}
          href="/developer-docs"
          target="_blank"
          rel="noopener"
          variant="outlined"
          endIcon={<OpenInNewRoundedIcon fontSize="small" />}
        >
          API reference
        </Button>
      }
    >
      <Stack spacing={3}>
        <Card>
          <CardHeader
            title="Quick start"
            subheader="Create a key below, then send your first template message."
            titleTypographyProps={{ variant: 'h6' }}
            subheaderTypographyProps={{ variant: 'body2' }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                borderRadius: 2,
                bgcolor: 'action.hover',
                overflowX: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.8125rem',
                lineHeight: 1.7,
              }}
            >
              <code>{CURL_EXAMPLE}</code>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              Free-form text (<code>/api/v1/send-text</code>) only reaches someone who messaged you in the
              last 24 hours. Outside that window, send an approved template.
            </Typography>
          </CardContent>
        </Card>

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_event, next) => setTab(next)} aria-label="Developer settings">
            {TABS.map((entry) => (
              <Tab key={entry.value} value={entry.value} label={entry.label} />
            ))}
          </Tabs>
        </Box>

        {tab === 'keys' ? <ApiKeysPanel /> : <WebhookDestinationsPanel />}
      </Stack>
    </PageBody>
  );
}
