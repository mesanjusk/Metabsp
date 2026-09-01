import { NextResponse } from 'next/server';
import { withApiKeyAccount, normalizeExternalPhone, externalApiError } from '@/lib/http/externalApi';
import { dispatchTemplateMessage } from '@/lib/whatsapp/dispatch';

/**
 * POST /api/v1/send-template — an approved message template.
 *
 * The only way to start a conversation with someone who has not messaged the
 * business in the last 24 hours, and therefore the endpoint most integrations
 * should reach for by default.
 */
export const POST = withApiKeyAccount('send-template', async ({ principal, accountContext, body }) => {
  const phone = normalizeExternalPhone(body?.phone || body?.to);
  const templateName = String(body?.template || body?.templateName || '');

  if (!phone || !templateName) {
    return NextResponse.json(
      { success: false, operation: 'send-template', message: 'phone and template are required' },
      { status: 400 }
    );
  }

  try {
    const data = await dispatchTemplateMessage({
      accountContext,
      userId: principal.userId,
      to: phone,
      templateName,
      language: String(body?.language || 'en_US'),
      components: Array.isArray(body?.components) ? body.components : [],
    });
    return NextResponse.json({ success: true, message: 'Template sent', data });
  } catch (error) {
    return externalApiError(error, 'send-template');
  }
});
