import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { getWebhookVerifyToken } from '@/lib/config/graphApi';
import { fetchAppWebhookFields } from '@/lib/services/preflightCheckService';
import { compareCallbackUrls, subscribeAppWebhook } from '@/lib/services/metaWebhookSubscriptionService';

// The callback URL is always derived from the request's own host and never
// from the body. An endpoint that accepts a URL and hands it to Meta is an
// endpoint for redirecting somebody else's WhatsApp traffic.
const resolveOwnCallbackUrl = (req: NextRequest) => {
  const forwardedProto = (req.headers.get('x-forwarded-proto') || '').split(',')[0].trim();
  const url = new URL(req.url);
  const protocol = forwardedProto || url.protocol.replace(':', '') || 'https';
  const host = req.headers.get('host') || url.host;
  return `${protocol}://${host}/webhook`;
};

// Ported from backend/src/controllers/whatsappController.js's getMetaWebhookConfig,
// then extended: showing the values to paste is only half the question. The
// other half — the one this deployment could not answer for weeks — is what
// Meta currently holds, which is a separate stored value that an edit in the
// App Dashboard can quietly fail to update.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const callbackUrl = resolveOwnCallbackUrl(req);
    const live = await fetchAppWebhookFields({});
    const comparison = compareCallbackUrls({ current: live.callbackUrl, expected: callbackUrl });

    return NextResponse.json({
      success: true,
      data: {
        callbackUrl,
        verifyToken: getWebhookVerifyToken(),
        appId: process.env.META_APP_ID || '',
        meta: {
          status: live.status,
          reason: live.reason || '',
          callbackUrl: live.callbackUrl || '',
          fields: live.fields || [],
          active: live.active !== false,
        },
        comparison,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load webhook config');
  }
}

// Repoint the app's whatsapp_business_account subscription at this deployment.
//
// This exists because pasting the URL into the App Dashboard is not reliably
// enough: this deployment did exactly that, watched the verify handshake pass,
// and kept delivering every inbound message to a previous host. Writing the
// subscription through the Graph API is the same operation without the step
// that silently did not take.
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const before = await fetchAppWebhookFields({});
    const callbackUrl = resolveOwnCallbackUrl(req);
    const result = await subscribeAppWebhook({ callbackUrl });
    const after = await fetchAppWebhookFields({});

    return NextResponse.json({
      success: true,
      message: `Meta now delivers to ${callbackUrl}`,
      data: {
        previousCallbackUrl: before.callbackUrl || '',
        callbackUrl: after.callbackUrl || result.callbackUrl,
        fields: after.fields?.length ? after.fields : result.fields,
        comparison: compareCallbackUrls({ current: after.callbackUrl, expected: callbackUrl }),
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to update the webhook subscription');
  }
}
