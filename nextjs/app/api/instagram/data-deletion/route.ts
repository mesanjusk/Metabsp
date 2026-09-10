import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { deleteByProviderId, parseSignedRequest } from '@/lib/services/dataDeletionService';

async function readSignedRequest(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return String(body?.signed_request || '');
  }
  const form = await req.formData();
  return String(form.get('signed_request') || '');
}

export async function POST(req: NextRequest) {
  const appSecret = String(process.env.INSTAGRAM_APP_SECRET || '');
  if (!appSecret) return NextResponse.json({ error: 'Instagram data deletion is not configured' }, { status: 503 });

  let signedRequest = '';
  try {
    signedRequest = await readSignedRequest(req);
  } catch (_error) {
    return NextResponse.json({ error: 'Malformed request' }, { status: 400 });
  }

  const signedPayload = parseSignedRequest(signedRequest, appSecret);
  if (!signedPayload?.user_id) return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 });

  try {
    await connectDB();
  } catch (_error) {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }

  const outcome = await deleteByProviderId({
    provider: 'instagram',
    providerUserId: String(signedPayload.user_id),
  });
  if (outcome.status === 'failed') {
    return NextResponse.json({ error: 'Deletion could not be completed' }, { status: 500 });
  }

  const origin = (process.env.FRONTEND_URL || req.nextUrl.origin).replace(/\/$/, '');
  return NextResponse.json({
    url: `${origin}/data-deletion/status?code=${outcome.confirmationCode}`,
    confirmation_code: outcome.confirmationCode,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Instagram data deletion callback',
    method: 'POST',
    expects: 'signed_request',
    instructions: '/data-deletion',
  });
}
