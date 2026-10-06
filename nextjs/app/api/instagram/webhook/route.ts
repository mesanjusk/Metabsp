import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { InstagramAccount } from '@/lib/models';

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const enforce = process.env.INSTAGRAM_ENFORCE_WEBHOOK_SIGNATURE !== 'false';
  if (!enforce) return true;

  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret || !signatureHeader?.startsWith('sha256=')) return false;

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signatureHeader);
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');
  const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return NextResponse.json({ success: false, message: 'Webhook verification failed' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifySignature(rawBody, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ success: false, message: 'Invalid webhook signature' }, { status: 403 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody || '{}');
  } catch (_error) {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  // Acknowledge only Instagram objects. The webhook intentionally stores no
  // message/comment bodies yet; it records delivery health and leaves event
  // processing to the automation/inbox layer that will consume these events.
  if (payload?.object === 'instagram' && Array.isArray(payload?.entry)) {
    try {
      await connectDB();
      const ids = payload.entry.map((entry: any) => String(entry?.id || '')).filter(Boolean);
      if (ids.length) {
        await InstagramAccount.updateMany(
          { instagramUserId: { $in: ids }, isActive: true },
          { $set: { lastWebhookAt: new Date() } }
        );
      }
    } catch (_error) {
      // Meta needs a fast 200 to avoid retry storms. Processing failures can be
      // surfaced through logs/health checks without rejecting a valid webhook.
    }
  }

  return new NextResponse('EVENT_RECEIVED', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
