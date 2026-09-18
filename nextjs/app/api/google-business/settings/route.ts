import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { getActiveGoogleBusinessAccount } from '@/lib/googleBusiness/google';

function settings(account: any) {
  return {
    autoReplyEnabled: Boolean(account.autoReplyEnabled),
    autoReplyMinRating: Number(account.autoReplyMinRating || 4),
    customToneRules: String(account.customToneRules || ''),
    allowReviewReplyEmojis: Boolean(account.allowReviewReplyEmojis),
    reviewSupportContact: String(account.reviewSupportContact || ''),
  };
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const account: any = await getActiveGoogleBusinessAccount(authed.id);
    if (!account) throw new AppError('Connect a Google Business Profile first', 409);
    return NextResponse.json({ success: true, data: settings(account) });
  } catch (error) {
    return errorResponse(error, 'Failed to load Google review settings');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const account: any = await getActiveGoogleBusinessAccount(authed.id);
    if (!account) throw new AppError('Connect a Google Business Profile first', 409);

    const body = await req.json();
    if (body.autoReplyEnabled !== undefined) account.autoReplyEnabled = Boolean(body.autoReplyEnabled);
    if (body.autoReplyMinRating !== undefined) {
      const rating = Number(body.autoReplyMinRating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new AppError('autoReplyMinRating must be an integer from 1 to 5', 400);
      }
      account.autoReplyMinRating = rating;
    }
    if (body.customToneRules !== undefined) {
      account.customToneRules = String(body.customToneRules || '').trim().slice(0, 1000);
    }
    if (body.allowReviewReplyEmojis !== undefined) {
      account.allowReviewReplyEmojis = Boolean(body.allowReviewReplyEmojis);
    }
    if (body.reviewSupportContact !== undefined) {
      account.reviewSupportContact = String(body.reviewSupportContact || '').trim().slice(0, 300);
    }

    await account.save();
    return NextResponse.json({ success: true, data: settings(account) });
  } catch (error) {
    return errorResponse(error, 'Failed to save Google review settings');
  }
}
