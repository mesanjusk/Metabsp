import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { GoogleBusinessReview } from '@/lib/models';
import { resolveGoogleWorkspace } from '@/lib/googleBusiness/workspace';
import { replyToGoogleReview } from '@/lib/googleBusiness/profile';

export async function POST(req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { reviewId } = await params;
    const record: any = await GoogleBusinessReview.findOne({ userId: authed.id, reviewId });
    if (!record) throw new AppError('Review draft not found. Sync reviews first.', 404);
    if (!String(record.reviewReplyText || '').trim()) throw new AppError('This review has no reply draft to approve', 400);

    const { accessToken, path } = await resolveGoogleWorkspace(authed.id);
    const posted = await replyToGoogleReview(accessToken, path, reviewId, record.reviewReplyText);
    record.reviewReplyText = posted.comment || record.reviewReplyText;
    record.replyStatus = 'PUBLISHED';
    record.failureReason = '';
    record.publishedAt = posted.updateTime ? new Date(posted.updateTime) : new Date();
    await record.save();

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return errorResponse(error, 'Failed to approve Google review reply');
  }
}
