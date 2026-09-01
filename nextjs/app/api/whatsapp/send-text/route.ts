import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { checkUserRateLimit } from '@/lib/http/rateLimit';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { checkWhatsApp24hWindow } from '@/lib/whatsapp/twentyFourHourGuard';
import { dispatchTextMessage } from '@/lib/whatsapp/dispatch';
import AppError from '@/lib/utils/AppError';

// Ported from backend/src/controllers/whatsappController.js's sendText,
// with backend/src/middleware/whatsapp24hGuard.js's enforcement inlined
// (see lib/whatsapp/twentyFourHourGuard.ts). messagingLimiter from the
// original (30/min/user) is applied here via checkUserRateLimit.
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const allowed = await checkUserRateLimit(authed.id, { windowMs: 60 * 1000, maxRequests: 30 });
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Rate limit exceeded. Please retry later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { to, text, body: bodyField, message, contactId, conversationId } = body || {};
    const resolvedText = String(text || bodyField || message || '').trim();
    if (!to || !resolvedText) throw new AppError('to and text are required', 400);

    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id);

    const windowCheck = await checkWhatsApp24hWindow({
      messageType: 'text',
      to,
      contactId,
      conversationId,
      whatsappAccountId: accountContext?.account?._id,
      userId: authed.id,
    });
    if (!windowCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'OUTSIDE_24H_WINDOW',
          message:
            'This contact is outside the 24-hour customer service window. Send an approved template instead.',
          lastCustomerMessageAt: windowCheck.lastUserMessageAt,
        },
        { status: 403 }
      );
    }

    const data = await dispatchTextMessage({ accountContext, userId: authed.id, to, body: resolvedText });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to send message');
  }
}
