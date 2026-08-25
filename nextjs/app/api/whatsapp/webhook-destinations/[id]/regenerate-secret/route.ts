import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WebhookDestination from '@/lib/models/WebhookDestination';
import { sanitize } from '@/lib/whatsapp/webhookDestinations';

// Ported from backend/src/routes/webhookDestinations.js.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const dest = await WebhookDestination.findOneAndUpdate(
      { _id: id, userId: authed.id },
      { $set: { secret: (WebhookDestination as any).generateSecret() } },
      { new: true }
    );
    if (!dest) {
      return NextResponse.json({ success: false, error: 'Webhook destination not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: sanitize(dest) });
  } catch (error) {
    return errorResponse(error, 'Failed to regenerate the webhook secret');
  }
}
