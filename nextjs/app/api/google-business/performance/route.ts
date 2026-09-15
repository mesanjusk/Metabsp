import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveGoogleWorkspace } from '@/lib/googleBusiness/workspace';
import { fetchGooglePerformance } from '@/lib/googleBusiness/profile';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { accessToken, account } = await resolveGoogleWorkspace(authed.id);

    // Google keeps roughly 18 months of daily metrics; the dashboard offers a
    // month or a quarter, and anything else is clamped rather than refused.
    const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days') || 30), 7), 180);
    const performance = await fetchGooglePerformance(accessToken, account.locationName, days);

    return NextResponse.json({ success: true, data: performance });
  } catch (error) {
    return errorResponse(error, 'Failed to load Google Business performance');
  }
}
