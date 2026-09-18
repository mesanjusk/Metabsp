import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { GoogleBusinessReview } from '@/lib/models';
import { resolveGoogleWorkspace } from '@/lib/googleBusiness/workspace';
import { replyToGoogleReview } from '@/lib/googleBusiness/profile';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { reviewId } = await params;
    const body = await req.json();
    const replyText = String(body?.replyText || '').trim();
    if (!replyText) throw new AppError('replyText is required', 400);
    if (replyText.length > 250) throw new AppError('Automated review replies are limited to 250 characters', 400);

    const { accessToken, path, account } = await resolveGoogleWorkspace(authed.id);
    const posted = await replyToGoogleReview(accessToken, path, reviewId, replyText);

    const record: any = await GoogleBusinessReview.findOneAndUpdate(
      { userId: authed.id, reviewId },
      {
        $set: {
          tenantId: account.tenantId || null,
          googleBusinessAccountId: account._id,
          reviewReplyText: posted.comment || replyText,
          replyStatus: 'PUBLISHED',
          failureReason: '',
          publishedAt: posted.updateTime ? new Date(posted.updateTime) : new Date(),
          lastSyncedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return errorResponse(error, 'Failed to edit and publish Google review reply');
  }
}
