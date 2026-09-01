'use client';

import { Alert, AlertTitle, Button, Stack } from '@mui/material';
import dynamic from 'next/dynamic';
import PageBody from '@/lib/ui/app/PageBody';
import { useDashboard } from '@/lib/ui/app/DashboardContext';
import ConnectChoiceCards from '@/lib/ui/app/ConnectChoiceCards';
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
      description="Both ways in are open to every account. Connect as many numbers as you need — each one sends, receives and runs its own automations."
    >
      <Stack spacing={3}>
        <ConnectChoiceCards onEmbedded={startConnect} onManual={openManualConnect} isBusy={isBusy} />

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
