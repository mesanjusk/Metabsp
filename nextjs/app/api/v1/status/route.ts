import { NextResponse } from 'next/server';
import { withApiKeyAccount } from '@/lib/http/externalApi';

/**
 * GET /api/v1/status — which number this API key sends from, and its health.
 *
 * The first call any integrator makes: it proves the key works and names the
 * number before they try to send anything with it.
 */
export const GET = withApiKeyAccount('status', async ({ accountContext }) => {
  const account = accountContext?.account;
  return NextResponse.json({
    success: true,
    data: {
      connected: true,
      phoneNumberId: accountContext?.phoneNumberId || '',
      displayPhoneNumber: account?.displayPhoneNumber || '',
      verifiedName: account?.verifiedName || '',
      connectionMode: account?.connectionMode || '',
      qualityRating: account?.qualityRating || '',
      status: account?.status || '',
    },
  });
});
