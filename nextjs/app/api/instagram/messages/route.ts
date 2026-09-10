import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { requireInstagramService } from '@/lib/instagram/access';
import { getInstagramAccess, instagramGraphRequest } from '@/lib/instagram/meta';
import AppError from '@/lib/utils/AppError';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireInstagramService(req);
    const conversationId = req.nextUrl.searchParams.get('conversationId')?.trim();
    if (!conversationId) throw new AppError('conversationId is required', 400);

    const { accessToken } = await getInstagramAccess(authed.id);
    const data = await instagramGraphRequest(`${encodeURIComponent(conversationId)}/messages`, accessToken, {
      params: { fields: 'id,created_time,from,to,message,attachments', limit: 50 },
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to load Instagram messages');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireInstagramService(req);
    const body = await req.json().catch(() => ({}));
    const recipientId = String(body?.recipientId || '').trim();
    const text = String(body?.text || '').trim();
    if (!recipientId) throw new AppError('recipientId is required', 400);
    if (!text) throw new AppError('text is required', 400);
    if (text.length > 1000) throw new AppError('text is too long', 400);

    const { account, accessToken } = await getInstagramAccess(authed.id);
    const data = await instagramGraphRequest(`${account.instagramUserId}/messages`, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: {
        recipient: { id: recipientId },
        messaging_type: 'RESPONSE',
        message: { text },
      },
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to send Instagram message');
  }
}
