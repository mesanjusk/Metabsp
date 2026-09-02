import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { runWebhookDiagnostics } from '@/lib/services/webhookDiagnosticsService';

/**
 * "Meta says the webhook is configured, so why is the inbox empty?"
 *
 * Walks the five stages an inbound message crosses and names the first one
 * that is broken — see lib/services/webhookDiagnosticsService.ts for why each
 * of them fails silently on its own.
 *
 * Admin-only: it reports the connected numbers and the Meta app's
 * subscription. It never returns the verify token or the app secret, only
 * whether each is set.
 *
 * Always answers 200 with a `severity`. It is a report, not a liveness probe;
 * a non-200 here would say the diagnostic failed, not that the webhook did.
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    // The origin Meta ought to be calling, derived the same way the
    // meta-webhook-config route derives the callback URL it tells admins to
    // paste — so "the URL Meta holds" and "the URL we told you to give it"
    // are compared on identical terms.
    const forwardedProto = (req.headers.get('x-forwarded-proto') || '').split(',')[0].trim();
    const url = new URL(req.url);
    const protocol = forwardedProto || url.protocol.replace(':', '') || 'https';
    const host = req.headers.get('host') || url.host;

    const { searchParams } = new URL(req.url);
    const includeWabaSubscriptions = String(searchParams.get('wabas') || 'true').toLowerCase() !== 'false';

    const report = await runWebhookDiagnostics({
      expectedOrigin: `${protocol}://${host}`,
      includeWabaSubscriptions,
    });

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return errorResponse(error, 'Webhook diagnostics failed');
  }
}
