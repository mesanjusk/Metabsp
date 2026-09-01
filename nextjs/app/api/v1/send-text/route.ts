import { NextResponse } from 'next/server';
import { withApiKeyAccount, normalizeExternalPhone, externalApiError } from '@/lib/http/externalApi';
import { dispatchTextMessage } from '@/lib/whatsapp/dispatch';
import { checkWhatsApp24hWindow } from '@/lib/whatsapp/twentyFourHourGuard';

/**
 * POST /api/v1/send-text — free-form text into an open conversation.
 *
 * Free-form text only reaches a recipient inside Meta's 24-hour customer
 * service window, i.e. someone who messaged the business recently. Outside it
 * the Cloud API rejects the send, and /api/v1/send-template is the correct
 * endpoint. That is a platform rule rather than a limitation here, so the
 * window is checked before the call and answered with a specific,
 * machine-readable error instead of leaving the caller to decode a generic
 * Meta failure.
 */
export const POST = withApiKeyAccount('send-text', async ({ principal, accountContext, body }) => {
  const phone = normalizeExternalPhone(body?.phone || body?.to);
  const text = String(body?.text || body?.message || '');

  if (!phone || !text) {
    return NextResponse.json(
      { success: false, operation: 'send-text', message: 'phone and text are required' },
      { status: 400 }
    );
  }

  const windowCheck = await checkWhatsApp24hWindow({
    messageType: 'text',
    to: phone,
    whatsappAccountId: accountContext?.account?._id,
    userId: principal.userId,
  });

  if (!windowCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        operation: 'send-text',
        code: 'OUTSIDE_24H_WINDOW',
        message:
          'This recipient is outside the 24-hour customer service window. Send an approved template with /api/v1/send-template instead.',
        lastCustomerMessageAt: windowCheck.lastUserMessageAt,
      },
      { status: 403 }
    );
  }

  try {
    const data = await dispatchTextMessage({
      accountContext,
      userId: principal.userId,
      to: phone,
      body: text,
    });
    return NextResponse.json({ success: true, message: 'Message sent', data });
  } catch (error) {
    return externalApiError(error, 'send-text');
  }
});
