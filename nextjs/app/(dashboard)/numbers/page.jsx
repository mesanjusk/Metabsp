'use client';

import { Alert, AlertTitle, Button, Stack } from '@mui/material';
import dynamic from 'next/dynamic';
import PageBody from '@/lib/ui/app/PageBody';
import { useDashboard } from '@/lib/ui/app/DashboardContext';
import LoadingSkeleton from '@/lib/ui/whatsappCloud/LoadingSkeleton';

const WhatsAppNumbersPanel = dynamic(() => import('@/lib/ui/whatsappCloud/WhatsAppNumbersPanel'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

/**
 * Connecting and managing WhatsApp numbers, on its own page.
 *
 * This was previously buried inside a "Settings" panel below three unrelated
 * sections — the first thing a new customer needs to do, and the flow Meta's
 * reviewers walk through, reachable only by scrolling past webhook, team and
 * billing configuration.
 */
export default function NumbersPage() {
  const { connection, openManualConnect, startConnect } = useDashboard();
  const { whatsappAccount, isAccountConnected, isBusy, refreshAccount, revalidate } = connection;

  const coexistence = whatsappAccount?.coexistence || null;
  const historySyncStatus = String(coexistence?.historySyncStatus || '');
  const historyProgress = Number(coexistence?.historySyncProgress);

  return (
    <PageBody
      title="WhatsApp numbers"
      description="Connect a business number through Meta, or attach one you already manage. Each connected number can send, receive and run automations independently."
      actions={
        <>
          <Button variant="outlined" onClick={openManualConnect} disabled={isBusy}>
            Use an existing token
          </Button>
          <Button variant="contained" onClick={startConnect} disabled={isBusy}>
            {isBusy ? 'Connecting…' : 'Connect with Meta'}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        {coexistence?.enabled ? (
          <Alert severity={historySyncStatus === 'completed' ? 'success' : 'info'}>
            <AlertTitle>Coexistence is on for this number</AlertTitle>
            Your WhatsApp Business app keeps working on this number alongside the API.
            {historySyncStatus === 'in_progress'
              ? Number.isFinite(historyProgress) && historyProgress > 0
                ? ` Importing your existing chats (${Math.round(historyProgress)}%) — they will appear in the inbox as they arrive.`
                : ' Importing your existing chats — they will appear in the inbox as they arrive.'
              : historySyncStatus === 'completed'
              ? ' Your existing chats have finished importing.'
              : ''}
          </Alert>
        ) : null}

        {isAccountConnected && whatsappAccount?.id ? (
          <Alert
            severity="info"
            action={
              <Button size="small" onClick={revalidate} disabled={isBusy}>
                Revalidate
              </Button>
            }
          >
            Sends failing unexpectedly? Revalidating re-checks this number&apos;s access token against Meta and
            reports exactly what is wrong.
          </Alert>
        ) : null}

        <WhatsAppNumbersPanel
          onConnect={startConnect}
          onManualConnect={openManualConnect}
          onChanged={refreshAccount}
          accountActionLoading={isBusy}
        />
      </Stack>
    </PageBody>
  );
}
