import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { getAdminOverview } from '@/lib/services/adminAnalyticsService';

// Ported from backend/src/routes/billing.js's GET /admin/overview.
//
// AdminAnalyticsPanel calls this on the dashboard's admin Settings tab. It was
// one of the billing routes deliberately left on Express, which was fine while
// the Vite frontend talked to Express — and stopped being fine the moment the
// dashboard moved here: the panel got Next.js's HTML 404 page and rendered the
// whole document into the UI.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const { searchParams } = new URL(req.url);
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    const overview = await getAdminOverview({
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
    });

    return NextResponse.json({ success: true, data: overview });
  } catch (error) {
    return errorResponse(error, 'Failed to load the admin overview');
  }
}
