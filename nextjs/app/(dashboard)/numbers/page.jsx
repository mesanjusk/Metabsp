'use client';

import { Alert, AlertTitle, Button, Paper, Stack, Typography } from '@mui/material';
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
  const { whatsappAccount, isAccountConnected, isBusy, refreshAccount, revalidate, coexistenceEnabled } = connection;

  const coexistence = whatsappAccount?.coexistence || null;
  const historySyncStatus = String(coexistence?.historySyncStatus || '');
  const historyProgress = Number(coexistence?.historySyncProgress);
  const accountId = whatsappAccount?.id || whatsappAccount?._id || '';
  // /api/whatsapp/account can intentionally fall back to Render's legacy
  // WHATSAPP_* environment credentials for the platform SUPER_ADMIN. That is a
  // transport fallback, not a WhatsAppAccount row saved to this workspace.
  // Only a persisted database account has an id and belongs in this screen's
  // "Connected WhatsApp numbers" state.
  const hasPersistedWorkspaceAccount = Boolean(accountId);
  const usingLegacyEnvFallback = !hasPersistedWorkspaceAccount && whatsappAccount?.source === 'legacy-env';
  const accountRefreshKey = [
    accountId,
    whatsappAccount?.status || '',
    whatsappAccount?.updatedAt || whatsappAccount?.connectedAt || '',
  ].join(':');
  const accountDisplay =
    whatsappAccount?.displayPhoneNumber || whatsappAccount?.phoneNumber || whatsappAccount?.phoneNumberId || '';

  return (
    <PageBody
      title="WhatsApp numbers"
      description="Both ways in are open to every account. Connect as many numbers as you need — each one sends, receives and runs its own automations."
    >
      <Stack spacing={3}>
        {!hasPersistedWorkspaceAccount ? (
          <>
            <ConnectChoiceCards
              onEmbedded={startConnect}
              onManual={openManualConnect}
              isBusy={isBusy}
              coexistenceEnabled={coexistenceEnabled}
            />
            {usingLegacyEnvFallback ? (
              <Alert severity="warning">
                <AlertTitle>No WhatsApp number is saved to this workspace yet</AlertTitle>
                Platform-level fallback credentials are configured on the server, but they are not a connected number for this workspace. Complete Embedded Signup or connect a number manually to save it here.
              </Alert>
            ) : null}
          </>
        ) : (
          <Alert severity="success">
            <AlertTitle>WhatsApp account saved to this workspace</AlertTitle>
            {accountDisplay
              ? `${accountDisplay} is saved in SanjuSK. Use “Connect another number” below only if you want to add another WhatsApp number.`
              : 'Your WhatsApp account is saved in SanjuSK. Use “Connect another number” below only if you want to add another WhatsApp number.'}
          </Alert>
        )}

        {hasPersistedWorkspaceAccount && coexistence?.enabled ? (
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

        {hasPersistedWorkspaceAccount && isAccountConnected ? (
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

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3 }}>
          <Stack spacing={1.5}>
            <div>
              <Typography variant="subtitle1" fontWeight={700}>Verified business badge assistance</Typography>
              <Typography variant="body2" color="text.secondary">
                Meta decides badge eligibility and approval. MetaBSP cannot grant or guarantee a “Green Tick”, but this checklist helps you prepare the business and number before applying in Meta.
              </Typography>
            </div>
            <Stack spacing={0.75}>
              <Typography variant="body2">1. Complete Meta Business Verification with legal business details that match your documents.</Typography>
              <Typography variant="body2">2. Keep the WhatsApp display name, website, business profile and phone details consistent with the verified business.</Typography>
              <Typography variant="body2">3. Keep messaging quality healthy and follow WhatsApp Business messaging and opt-in policies.</Typography>
              <Typography variant="body2">4. When Meta shows the verified-badge / official-business-account option for the business, submit the request from Meta&apos;s own Business/WhatsApp Manager.</Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                component="a"
                href="https://business.facebook.com/settings/security"
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                size="small"
              >
                Open Meta Security Center
              </Button>
              <Button
                component="a"
                href="https://business.facebook.com/wa/manage/home/"
                target="_blank"
                rel="noopener noreferrer"
                variant="text"
                size="small"
              >
                Open WhatsApp Manager
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <WhatsAppNumbersPanel
          onConnect={startConnect}
          onManualConnect={openManualConnect}
          onChanged={refreshAccount}
          accountActionLoading={isBusy}
          refreshKey={accountRefreshKey}
        />
      </Stack>
    </PageBody>
  );
}
