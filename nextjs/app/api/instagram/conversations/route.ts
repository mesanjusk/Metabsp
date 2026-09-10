import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { requireInstagramService } from '@/lib/instagram/access';
import { getInstagramAccess, instagramGraphRequest } from '@/lib/instagram/meta';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireInstagramService(req);
    const { account, accessToken } = await getInstagramAccess(authed.id);
    const data = await instagramGraphRequest(`${account.instagramUserId}/conversations`, accessToken, {
      params: {
        platform: 'instagram',
        fields: 'id,participants,updated_time',
        limit: 25,
      },
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to load Instagram conversations');
  }
}
