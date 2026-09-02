import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { decryptSensitiveValue } from '@/lib/utils/crypto';
import { checkWhatsAppHealth } from '@/lib/services/whatsappHealthService';
import { getGraphApiVersion } from '@/lib/config/graphApi';
import { sanitizeAccount, subscribeAppToWaba } from '@/lib/whatsapp/connect';
import AppError from '@/lib/utils/AppError';

/**
 * Revalidate — and repair — one connected number.
 *
 * The health check alone answered half the question. Sending and receiving
 * fail independently and for different reasons: a send needs a valid token and
 * phone number id, which is all `checkWhatsAppHealth` looks at, while
 * receiving additionally needs this app to be in the WABA's `subscribed_apps`.
 * A number can therefore pass revalidation, send perfectly, and never deliver
 * a single inbound message.
 *
 * `subscribeAppToWaba` runs at connect time and is best-effort by design — it
 * logs and returns false rather than failing the connection. That was a
 * one-way door: nothing retried it, and revalidation did not either, so a WABA
 * whose subscription failed once stayed detached until somebody reconnected
 * the account from scratch. Re-asserting it here is idempotent (Meta treats a
 * repeat POST as a no-op) and makes this endpoint the repair it was already
 * assumed to be.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const existing: any = await WhatsAppAccount.findOne({ _id: id, userId: authed.id });
    if (!existing) throw new AppError('Account not found', 404);

    const accountContext = {
      accessToken: decryptSensitiveValue(existing.accessTokenEncrypted),
      phoneNumberId: String(existing.phoneNumberId || ''),
      graphVersion: getGraphApiVersion(),
    };
    const health = await checkWhatsAppHealth(accountContext);

    // Only worth attempting against a live token — a re-subscribe with a dead
    // one fails for a reason that has nothing to do with the subscription and
    // would report the wrong problem.
    const wabaId = String(existing.wabaId || '');
    const webhookSubscribed =
      health.isConnected && wabaId
        ? await subscribeAppToWaba({ wabaId, accessToken: accountContext.accessToken })
        : false;

    existing.status = health.isConnected ? 'active' : 'error';
    existing.lastSyncAt = new Date();
    if (health.isConnected && wabaId) existing.webhookSubscribed = webhookSubscribed;
    await existing.save();

    return NextResponse.json({
      success: true,
      data: sanitizeAccount(existing),
      validation: health,
      // Reported separately from `validation` because it answers the other
      // half: whether inbound messages can arrive, not whether outbound ones
      // can leave.
      webhook: {
        wabaId,
        subscribed: webhookSubscribed,
        note: !wabaId
          ? 'No WABA id stored for this number — inbound webhooks cannot be subscribed'
          : !health.isConnected
            ? 'Skipped: the access token did not pass the health check'
            : webhookSubscribed
              ? 'This app is subscribed to the WABA — inbound messages will be delivered to the webhook'
              : 'Could not subscribe this app to the WABA; inbound messages will not arrive. Check the server log for Meta\'s reason.',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to revalidate account');
  }
}
