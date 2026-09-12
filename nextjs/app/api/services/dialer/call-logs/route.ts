import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { requireServiceAccess } from '@/lib/services/serviceAccess';
import { errorResponse } from '@/lib/http/errorResponse';

// The Business Dialer surfaces call history recorded by the Business Call
// Manager app (vendor/BusinessCallManager). That project is a separate
// Node/Express + MongoDB backend that the QuickLink Caller Android app syncs
// device call logs into, keyed by `user_uuid`. This route is a thin,
// server-side proxy to its `POST /logs/getAllLogs` endpoint so the dashboard
// never talks to the provider directly and no provider URL is exposed to the
// browser.
//
// The provider is optional: with BUSINESS_CALL_MANAGER_API_URL unset the route
// answers `configured: false` and the UI shows setup guidance instead of an
// error. This keeps deployments that have not connected the dialer working.

const DAY = 24 * 60 * 60 * 1000;

function providerBaseUrl() {
  return String(process.env.BUSINESS_CALL_MANAGER_API_URL || '').trim().replace(/\/+$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    await requireServiceAccess(authed, 'dialer');

    const base = providerBaseUrl();
    if (!base) {
      return NextResponse.json({ success: true, data: { configured: false, logs: [] } });
    }

    const body = await req.json().catch(() => ({}));
    const now = Date.now();
    const toDate = Number(body?.toDate) || now;
    const fromDate = Number(body?.fromDate) || toDate - 30 * DAY;

    // The Business Call Manager keys every log by the caller's `user_uuid`. We
    // use the authenticated MetaBSP user id as that identifier so each account
    // only ever reads its own synced call history.
    const providerResponse = await fetch(`${base}/logs/getAllLogs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_uuid: authed.id, from_date: fromDate, to_date: toDate }),
      cache: 'no-store',
    });

    // The provider answers 404 with `{ success: false }` when the user simply
    // has no logs in range — that is an empty result here, not a failure.
    if (providerResponse.status === 404) {
      return NextResponse.json({ success: true, data: { configured: true, logs: [] } });
    }

    if (!providerResponse.ok) {
      return NextResponse.json(
        { success: false, message: 'The Business Call Manager provider is not reachable right now.' },
        { status: 502 }
      );
    }

    const payload = await providerResponse.json().catch(() => ({}));
    const logs = Array.isArray(payload?.logs) ? payload.logs : [];
    return NextResponse.json({ success: true, data: { configured: true, logs } });
  } catch (error) {
    return errorResponse(error, 'Failed to load call history');
  }
}
