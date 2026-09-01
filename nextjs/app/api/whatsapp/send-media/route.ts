import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { checkUserRateLimit } from '@/lib/http/rateLimit';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { checkWhatsApp24hWindow } from '@/lib/whatsapp/twentyFourHourGuard';
import { dispatchMediaMessage } from '@/lib/whatsapp/dispatch';
import { uploadBufferToCloudinary } from '@/lib/services/whatsappMediaService';
import AppError from '@/lib/utils/AppError';

// Ported from backend/src/controllers/whatsappController.js's sendMedia.
// The original used multer (Express-only) for the file-upload case; Route
// Handlers use the Web FormData API instead — same two paths (uploaded
// file vs. a direct link/mediaUrl/imageUrl/documentUrl) as the original.
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const allowed = await checkUserRateLimit(authed.id, { windowMs: 60 * 1000, maxRequests: 30 });
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Rate limit exceeded. Please retry later.' }, { status: 429 });
    }

    const contentType = req.headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');

    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id);

    if (isMultipart) {
      const formData = await req.formData();
      const to = String(formData.get('to') || '');
      const type = String(formData.get('type') || '');
      const caption = String(formData.get('caption') || '');
      const contactId = String(formData.get('contactId') || '');
      const conversationId = String(formData.get('conversationId') || '');
      const file = formData.get('file');

      if (!to || !type) throw new AppError('to and type are required', 400);

      const windowCheck = await checkWhatsApp24hWindow({
        messageType: type,
        to,
        contactId,
        conversationId,
        whatsappAccountId: accountContext?.account?._id,
        userId: authed.id,
      });
      if (!windowCheck.allowed) {
        return NextResponse.json({
          success: false,
          code: 'OUTSIDE_24H_WINDOW',
          message:
            'This contact is outside the 24-hour customer service window. Send an approved template instead.',
        },
        { status: 403 });
      }

      if (!(file instanceof File)) throw new AppError('file or media link is required', 400);

      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await uploadBufferToCloudinary({ buffer, mimeType: file.type || '', folder: 'whatsapp_media' });

      const data = await dispatchMediaMessage({
        accountContext,
        userId: authed.id,
        to,
        type,
        link: uploaded.secure_url,
        caption: caption || '',
        filename: file.name || '',
      });

      return NextResponse.json({ success: true, data });
    }

    const body = await req.json().catch(() => ({}));
    const { to, type, caption, contactId, conversationId } = body || {};
    if (!to || !type) throw new AppError('to and type are required', 400);

    const windowCheck = await checkWhatsApp24hWindow({
      messageType: type,
      to,
      contactId,
      conversationId,
      whatsappAccountId: accountContext?.account?._id,
      userId: authed.id,
    });
    if (!windowCheck.allowed) {
      return NextResponse.json({
          success: false,
          code: 'OUTSIDE_24H_WINDOW',
          message:
            'This contact is outside the 24-hour customer service window. Send an approved template instead.',
        },
        { status: 403 });
    }

    const link = body?.link || body?.mediaUrl || body?.imageUrl || body?.documentUrl || '';
    if (!link) throw new AppError('file or media link is required', 400);

    const data = await dispatchMediaMessage({
      accountContext,
      userId: authed.id,
      to,
      type,
      link,
      caption: caption || '',
      filename: body?.filename || '',
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to send media message');
  }
}
