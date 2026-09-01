import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import logger from '@/lib/utils/logger';
import Subscription from '@/lib/models/Subscription';
import Invoice from '@/lib/models/Invoice';
import { classifyWebhookEvent, verifyWebhookSignature } from '@/lib/services/paymentGatewayService';

/**
 * The payment gateway's callback. Deliberately unauthenticated in the session
 * sense — the gateway calls it directly — with the HMAC signature check below
 * standing in as the authentication.
 *
 * Same discipline as the Meta webhook: read the raw body first, verify the
 * signature over exactly those bytes, and only then parse. Parsing before
 * verifying means acting on a payload whose origin has not been established.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  try {
    const signature = req.headers.get('x-webhook-signature');
    const timestamp = req.headers.get('x-webhook-timestamp');

    if (!verifyWebhookSignature({ rawBody, signature, timestamp })) {
      logger.warn('[billing-webhook] Signature verification failed');
      return NextResponse.json({ success: false, message: 'Invalid signature' }, { status: 401 });
    }

    await connectDB();
    const event = classifyWebhookEvent(JSON.parse(rawBody || '{}'));

    if (event.kind === 'mandate_activated' && event.gatewaySubscriptionId) {
      await Subscription.findOneAndUpdate(
        { gatewaySubscriptionId: event.gatewaySubscriptionId },
        { status: 'active', mandateAuthorizedAt: new Date() }
      );
    } else if (event.kind === 'payment_success' && event.gatewaySubscriptionId) {
      const subscription: any = await Subscription.findOne({ gatewaySubscriptionId: event.gatewaySubscriptionId });
      if (subscription) {
        await Invoice.findOneAndUpdate(
          { subscriptionId: subscription._id, status: 'pending' },
          { status: 'paid', gatewayPaymentId: event.gatewayPaymentId, paidAt: new Date() },
          { sort: { createdAt: -1 } }
        );
        subscription.status = 'active';
        await subscription.save();
      }
    } else if (event.kind === 'payment_failed' && event.gatewaySubscriptionId) {
      await Subscription.findOneAndUpdate(
        { gatewaySubscriptionId: event.gatewaySubscriptionId },
        { status: 'past_due' }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    logger.error('[billing-webhook] Processing failed:', error);
    // The signature already proved this came from the gateway, so a processing
    // failure is ours: 500 asks the gateway to retry rather than dropping a
    // payment event.
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
