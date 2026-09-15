import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveGoogleWorkspace } from '@/lib/googleBusiness/workspace';
import { buildLocalPostPayload, createGoogleLocalPost, listGoogleLocalPosts } from '@/lib/googleBusiness/profile';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { accessToken, path } = await resolveGoogleWorkspace(authed.id);
    const posts = await listGoogleLocalPosts(accessToken, path, 20);
    return NextResponse.json({ success: true, data: posts });
  } catch (error) {
    return errorResponse(error, 'Failed to load Google posts');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json();

    const { accessToken, path } = await resolveGoogleWorkspace(authed.id);
    const payload = buildLocalPostPayload({
      summary: String(body?.summary || ''),
      actionType: String(body?.actionType || 'LEARN_MORE'),
      actionUrl: String(body?.actionUrl || ''),
      mediaUrl: String(body?.mediaUrl || ''),
      languageCode: String(body?.languageCode || 'en'),
    });

    const post = await createGoogleLocalPost(accessToken, path, payload);
    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    return errorResponse(error, 'Failed to publish the Google post');
  }
}
