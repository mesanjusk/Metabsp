import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { resolveGoogleWorkspace } from '@/lib/googleBusiness/workspace';
import { deleteGoogleReviewReply, listGoogleReviews, replyToGoogleReview } from '@/lib/googleBusiness/profile';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { accessToken, path, account } = await resolveGoogleWorkspace(authed.id);

    const pageSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get('pageSize') || 50), 1), 50);
    const result = await listGoogleReviews(accessToken, path, pageSize);

    return NextResponse.json({
      success: true,
      data: { ...result, newReviewUri: account.newReviewUri || '', mapsUri: account.mapsUri || '' },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load Google reviews');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json();
    const reviewId = String(body?.reviewId || '').trim();
    const comment = String(body?.comment || '').trim();
    if (!reviewId) throw new AppError('reviewId is required', 400);

    const { accessToken, path } = await resolveGoogleWorkspace(authed.id);
    const reply = await replyToGoogleReview(accessToken, path, reviewId, comment);
    return NextResponse.json({ success: true, data: reply });
  } catch (error) {
    return errorResponse(error, 'Failed to publish the review reply');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const reviewId = String(req.nextUrl.searchParams.get('reviewId') || '').trim();
    if (!reviewId) throw new AppError('reviewId is required', 400);

    const { accessToken, path } = await resolveGoogleWorkspace(authed.id);
    await deleteGoogleReviewReply(accessToken, path, reviewId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to remove the review reply');
  }
}
