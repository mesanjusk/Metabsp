import { NextResponse } from 'next/server';
import { withApiKeyAccount, normalizeExternalPhone, externalApiError } from '@/lib/http/externalApi';
import { dispatchMediaMessage } from '@/lib/whatsapp/dispatch';
import { checkWhatsApp24hWindow } from '@/lib/whatsapp/twentyFourHourGuard';

const SUPPORTED_TYPES = ['image', 'video', 'audio', 'document', 'sticker'];

/**
 * POST /api/v1/send-media — an image, video, audio, document or sticker by URL.
 *
 * Replaces the Express API's image-only /send-image: the Cloud API treats all
 * five the same way, so one endpoint with a `type` is both less to document
 * and less to maintain than five near-identical ones. Media is a free-form
 * message, so the same 24-hour window rule as /send-text applies.
 */
export const POST = withApiKeyAccount('send-media', async ({ principal, accountContext, body }) => {
  const phone = normalizeExternalPhone(body?.phone || body?.to);
  const link = String(body?.link || body?.mediaUrl || body?.imageUrl || '');
  const type = String(body?.type || 'image').toLowerCase();

  if (!phone || !link) {
    return NextResponse.json(
      { success: false, operation: 'send-media', message: 'phone and link are required' },
      { status: 400 }
    );
  }
  if (!SUPPORTED_TYPES.includes(type)) {
    return NextResponse.json(
      {
        success: false,
        operation: 'send-media',
        message: `type must be one of: ${SUPPORTED_TYPES.join(', ')}`,
      },
      { status: 400 }
    );
  }
  if (!/^https:\/\//i.test(link)) {
    // Meta fetches this URL itself and requires HTTPS; failing here names the
    // problem instead of surfacing Meta's opaque media-download error.
    return NextResponse.json(
      { success: false, operation: 'send-media', message: 'link must be a publicly reachable HTTPS URL' },
      { status: 400 }
    );
  }

  const windowCheck = await checkWhatsApp24hWindow({
    messageType: type,
    to: phone,
    whatsappAccountId: accountContext?.account?._id,
    userId: principal.userId,
  });

  if (!windowCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        operation: 'send-media',
        code: 'OUTSIDE_24H_WINDOW',
        message:
          'This recipient is outside the 24-hour customer service window. Send an approved template with /api/v1/send-template instead.',
        lastCustomerMessageAt: windowCheck.lastUserMessageAt,
      },
      { status: 403 }
    );
  }

  try {
    const data = await dispatchMediaMessage({
      accountContext,
      userId: principal.userId,
      to: phone,
      type,
      link,
      caption: String(body?.caption || ''),
      filename: String(body?.filename || ''),
    });
    return NextResponse.json({ success: true, message: 'Media sent', data });
  } catch (error) {
    return externalApiError(error, 'send-media');
  }
});
