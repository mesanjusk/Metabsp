import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { runPreflightChecks } from '@/lib/services/preflightCheckService';

/**
 * Read-only configuration audit: webhook field subscriptions, coexistence
 * gating, and per-account token posture.
 *
 * Admin-only, because it reports which numbers are connected and how their
 * tokens are held. Always answers 200 with a `severity` — it is a report, not
 * a liveness probe, and a monitor should key off the payload rather than the
 * status code.
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    if (!authed.isAdmin) throw new AppError('Admin access required', 403);

    const { searchParams } = new URL(req.url);
    const includeWabaSubscriptions = String(searchParams.get('wabas') || '').toLowerCase() === 'true';

    const report = await runPreflightChecks({ includeWabaSubscriptions });
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return errorResponse(error, 'Preflight check failed');
  }
}
