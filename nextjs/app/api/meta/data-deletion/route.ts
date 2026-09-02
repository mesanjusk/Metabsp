import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { deleteByProviderId, parseSignedRequest } from '@/lib/services/dataDeletionService';
import logger from '@/lib/utils/logger';

/**
 * POST /api/meta/data-deletion — Meta's Data Deletion Callback.
 *
 * Meta calls this when someone removes this app from their Facebook settings.
 * It arrives as a form post carrying `signed_request`, and the reply must be
 * JSON with a status URL and a confirmation code the person can quote.
 *
 * This endpoint did not exist, while /data-deletion — a static page — claimed
 * to be a registered callback that "handles automated deletion callbacks".
 * Meta's POST reached a page route, got 405, and the deletion silently never
 * happened. The Data Use Checkup asks a provider to certify its data handling
 * practices; certifying that against a 405 is not something you can do.
 *
 * It lives under /api/meta/ rather than at /data-deletion because the App
 * Router cannot serve a page and a route handler from one path, and because
 * the two are genuinely different things: /data-deletion is the human-facing
 * instructions URL, this is the machine callback. Both fields exist in the
 * App Dashboard and both should be filled in.
 *
 * There is no session here — Meta is the caller. The HMAC over the payload,
 * keyed with the app secret, is the whole of the authentication, which is why
 * a request that fails it is refused rather than treated as unidentified.
 */
export async function POST(req: NextRequest) {
  const appSecret = String(process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET || '');

  if (!appSecret) {
    logger.error('[data-deletion] META_APP_SECRET is not set — cannot verify the callback');
    return NextResponse.json(
      { error: 'Data deletion callback is not configured' },
      { status: 503 }
    );
  }

  let signedRequest = '';
  try {
    // Meta sends application/x-www-form-urlencoded; accept JSON too so the
    // endpoint can be exercised by hand without guessing the encoding.
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      signedRequest = String(body?.signed_request || '');
    } else {
      const form = await req.formData();
      signedRequest = String(form.get('signed_request') || '');
    }
  } catch {
    return NextResponse.json({ error: 'Malformed request' }, { status: 400 });
  }

  const payload = parseSignedRequest(signedRequest, appSecret);
  if (!payload?.user_id) {
    logger.warn('[data-deletion] rejected a callback with an invalid signature');
    return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 });
  }

  try {
    await connectDB();
  } catch (error: any) {
    // Answering 200 here would tell Meta the deletion happened when nothing
    // was even read. A 503 is retried; a false success is not.
    logger.error({ err: error.message }, '[data-deletion] database unavailable');
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  const outcome = await deleteByProviderId({
    provider: 'facebook',
    providerUserId: String(payload.user_id),
  });

  if (outcome.status === 'failed') {
    return NextResponse.json({ error: 'Deletion could not be completed' }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  return NextResponse.json({
    url: `${origin}/data-deletion/status?code=${outcome.confirmationCode}`,
    confirmation_code: outcome.confirmationCode,
  });
}

/**
 * Meta does not GET this URL, but people paste callback URLs into browsers to
 * see whether they are alive. Saying what it is beats an unexplained 405.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'Meta data deletion callback',
    method: 'POST',
    expects: 'signed_request',
    instructions: '/data-deletion',
  });
}
