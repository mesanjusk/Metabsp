import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { syncGoogleReviewsForUser } from '@/lib/googleBusiness/reviewAutomation';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const result = await syncGoogleReviewsForUser(authed.id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error, 'Failed to sync Google reviews');
  }
}
