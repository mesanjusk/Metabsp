import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { getInstagramAccess, instagramGraphRequest } from '@/lib/instagram/meta';
import AppError from '@/lib/utils/AppError';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const imageUrl = String(body?.imageUrl || '').trim();
    const caption = String(body?.caption || '').trim();

    if (!imageUrl) throw new AppError('imageUrl is required', 400);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch (_error) {
      throw new AppError('imageUrl must be a valid public HTTPS URL', 400);
    }
    if (parsedUrl.protocol !== 'https:') throw new AppError('imageUrl must use HTTPS', 400);
    if (caption.length > 2200) throw new AppError('caption is too long', 400);

    const { account, accessToken } = await getInstagramAccess(authed.id);
    const container: any = await instagramGraphRequest(`${account.instagramUserId}/media`, accessToken, {
      method: 'POST',
      params: { image_url: imageUrl, ...(caption ? { caption } : {}) },
    });
    const creationId = String(container?.id || '');
    if (!creationId) throw new AppError('Instagram did not return a media container ID', 502);

    const published: any = await instagramGraphRequest(`${account.instagramUserId}/media_publish`, accessToken, {
      method: 'POST',
      params: { creation_id: creationId },
    });

    return NextResponse.json({
      success: true,
      data: { containerId: creationId, mediaId: String(published?.id || '') },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to publish Instagram image');
  }
}
