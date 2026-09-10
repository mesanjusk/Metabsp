import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { InstagramAccount } from '@/lib/models';
import { parseSignedRequest } from '@/lib/services/dataDeletionService';

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
  if (!appSecret) return NextResponse.json({ error: 'Instagram callback is not configured' }, { status: 503 });

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
    const providerUserId = String(signedPayload.user_id);
    await InstagramAccount.updateMany(
      {
        $or: [
          { instagramAppScopedId: providerUserId },
          { instagramUserId: providerUserId },
        ],
      },
      {
        $set: {
          isActive: false,
          status: 'disconnected',
          webhookSubscribed: false,
          tokenExpiresAt: new Date(),
        },
      }
    );
    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ endpoint: 'Instagram deauthorization callback', method: 'POST' });
}
