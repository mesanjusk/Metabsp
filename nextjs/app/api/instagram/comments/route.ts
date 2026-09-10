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
    const mediaId = req.nextUrl.searchParams.get('mediaId')?.trim();
    if (!mediaId) throw new AppError('mediaId is required', 400);

    const { accessToken } = await getInstagramAccess(authed.id);
    const data = await instagramGraphRequest(`${encodeURIComponent(mediaId)}/comments`, accessToken, {
      params: { fields: 'id,text,username,timestamp,from,replies', limit: 50 },
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to load Instagram comments');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireInstagramService(req);
    const body = await req.json().catch(() => ({}));
    const commentId = String(body?.commentId || '').trim();
    const text = String(body?.text || '').trim();
    if (!commentId) throw new AppError('commentId is required', 400);
    if (!text) throw new AppError('text is required', 400);
    if (text.length > 1000) throw new AppError('text is too long', 400);

    const { account, accessToken } = await getInstagramAccess(authed.id);
    const data = await instagramGraphRequest(`${account.instagramUserId}/messages`, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: {
        recipient: { comment_id: commentId },
        message: { text },
      },
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to reply privately to Instagram comment');
  }
}
