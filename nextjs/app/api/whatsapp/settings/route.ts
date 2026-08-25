import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';

// Account feature flags, stored under the account's `metadata`.
// Webhook forwarding is NOT here — it is self-service and multi-destination
// (see the webhookDestinations routes), not a single callbackUrl.
const SETTINGS_KEYS = [
  'analyticsEnabled',
  'autoReplyEnabled',
  'webhookHealthAlerts',
  'defaultCountryCode',
  'timezone',
];

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const account: any = await WhatsAppAccount.findOne({ userId: authed.id, isActive: true }).lean();
    const meta = account?.metadata || {};

    return NextResponse.json({
      success: true,
      data: {
        analyticsEnabled: meta.analyticsEnabled ?? true,
        autoReplyEnabled: meta.autoReplyEnabled ?? true,
        webhookHealthAlerts: meta.webhookHealthAlerts ?? false,
        defaultCountryCode: meta.defaultCountryCode ?? '+1',
        timezone: meta.timezone ?? 'UTC',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load settings');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Allow-listed: the body is written into `metadata`, so an unfiltered
    // assignment would let a caller set arbitrary keys on the account document.
    const metaUpdate = Object.fromEntries(
      SETTINGS_KEYS.filter((k) => k in body).map((k) => [`metadata.${k}`, body[k]])
    );

    if (Object.keys(metaUpdate).length) {
      await WhatsAppAccount.updateOne({ userId: authed.id, isActive: true }, { $set: metaUpdate });
    }

    return NextResponse.json({ success: true, message: 'Settings saved.' });
  } catch (error) {
    return errorResponse(error, 'Failed to save settings');
  }
}
