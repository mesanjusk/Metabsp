import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { resolveGoogleWorkspace } from '@/lib/googleBusiness/workspace';
import { draftLocalPost, draftReviewReply, draftReviewRequest } from '@/lib/googleBusiness/ai';
import { listGoogleReviews } from '@/lib/googleBusiness/profile';

/**
 * One drafting endpoint for the three things the owner writes.
 *
 * A review reply is drafted from the review Google holds, not from text the
 * client posts: it is the difference between "reply to review 12345" and
 * "reply to whatever this browser says review 12345 said", and the reply is
 * published publicly under the merchant's name.
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json();
    const kind = String(body?.kind || '').trim();
    const tone = String(body?.tone || '').trim();

    const { accessToken, path, business } = await resolveGoogleWorkspace(authed.id);

    if (kind === 'review-reply') {
      const reviewId = String(body?.reviewId || '').trim();
      if (!reviewId) throw new AppError('reviewId is required', 400);

      const { reviews } = await listGoogleReviews(accessToken, path, 50);
      const review = reviews.find((item: any) => item.reviewId === reviewId);
      if (!review) throw new AppError('That review is not in the current page of reviews', 404);

      const draft = await draftReviewReply(business, review, tone || undefined);
      return NextResponse.json({ success: true, data: { draft, review } });
    }

    if (kind === 'post') {
      const draft = await draftLocalPost(business, String(body?.topic || ''), tone || undefined);
      return NextResponse.json({ success: true, data: { draft } });
    }

    if (kind === 'review-request') {
      const draft = await draftReviewRequest(business, String(body?.customerName || ''));
      return NextResponse.json({ success: true, data: { draft } });
    }

    throw new AppError('kind must be review-reply, post or review-request', 400);
  } catch (error) {
    return errorResponse(error, 'Failed to generate the draft');
  }
}
