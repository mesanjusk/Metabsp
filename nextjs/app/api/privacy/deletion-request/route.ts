import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { checkAuthRateLimit } from '@/lib/http/rateLimit';
import { createManualDeletionRequest } from '@/lib/services/dataDeletionService';
import logger from '@/lib/utils/logger';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const allowed = await checkAuthRateLimit(req, {
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    scope: 'privacy-deletion-request',
  });

  if (!allowed) {
    return NextResponse.json(
      { success: false, message: 'Too many deletion requests from this network. Please try again later.' },
      { status: 429 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 });
  }

  const email = String(body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ success: false, message: 'Enter a valid email address.' }, { status: 400 });
  }

  try {
    await connectDB();
    const request = await createManualDeletionRequest({
      requesterEmail: email,
      accountId: body?.accountId,
      reason: body?.reason,
      notes: body?.notes,
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    return NextResponse.json({
      success: true,
      confirmationCode: request.confirmationCode,
      statusUrl: `${origin}/data-deletion/status?code=${request.confirmationCode}`,
      status: request.status,
      message: 'Your deletion request has been recorded for identity verification and processing.',
    });
  } catch (error: any) {
    logger.error({ err: error?.message }, '[data-deletion] manual request intake failed');
    return NextResponse.json(
      { success: false, message: 'Could not record the deletion request. Please contact privacy support.' },
      { status: 500 },
    );
  }
}
