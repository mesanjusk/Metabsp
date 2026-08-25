import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import WebhookDestination from '@/lib/models/WebhookDestination';

// Ported from backend/src/routes/webhookDestinations.js.
//
// Unauthenticated on purpose: a keep-alive pinger (GitHub Actions or any
// other external cron) needs to discover which sibling services to ping
// without needing credentials. Only label + url are exposed — never a secret.
//
// That said, the list spans EVERY tenant, so as written it publishes each
// customer's receiving endpoint to anyone who requests it. Setting
// KEEP_ALIVE_TOKEN closes that: when the variable is present the caller must
// send it as `X-Keep-Alive-Token` (or `?token=`). When it is unset the
// endpoint behaves exactly as the Express original did, so an existing
// pinger keeps working until the token is configured on both ends.
export async function GET(req: NextRequest) {
  try {
    const expectedToken = process.env.KEEP_ALIVE_TOKEN || '';
    if (expectedToken) {
      const provided =
        req.headers.get('x-keep-alive-token') || new URL(req.url).searchParams.get('token') || '';
      if (provided !== expectedToken) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    await connectDB();
    const destinations = await WebhookDestination.find({ isActive: true }).select('label url').lean();

    return NextResponse.json({
      success: true,
      targets: (destinations as any[]).map((dest) => ({ label: dest.label, url: dest.url })),
    });
  } catch (error) {
    return errorResponse(error, 'Failed to list keep-alive targets');
  }
}
