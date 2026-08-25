import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WebhookDestination from '@/lib/models/WebhookDestination';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import {
  validateUrl,
  validateKeywords,
  normalizeKeyword,
  normalizeAliases,
  sanitize,
  resolveOwnedAccount,
} from '@/lib/whatsapp/webhookDestinations';

// Ported from backend/src/routes/webhookDestinations.js.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const account = await resolveOwnedAccount(authed.id);
    if (!account) return NextResponse.json({ success: true, data: [] });

    const destinations = await WebhookDestination.find({ whatsappAccountId: account._id })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ success: true, data: (destinations as any[]).map(sanitize) });
  } catch (error) {
    return errorResponse(error, 'Failed to list webhook destinations');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const body = await req.json().catch(() => ({}));
    const { label = 'My project', url, isActive, entryKeyword, aliases, fanoutFallback } = body || {};

    const urlError = validateUrl(url);
    if (urlError) return NextResponse.json({ success: false, error: urlError }, { status: 400 });

    const account: any = await WhatsAppAccount.findOne({ userId: authed.id, isActive: true }).sort({ updatedAt: -1 });
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Connect a WhatsApp number before adding webhook destinations.' },
        { status: 400 }
      );
    }

    const normalizedKeyword = normalizeKeyword(entryKeyword);
    const normalizedAliases = normalizeAliases(aliases);
    const keywordError = await validateKeywords({
      entryKeyword: normalizedKeyword,
      aliases: normalizedAliases,
      whatsappAccountId: account._id,
    });
    if (keywordError) return NextResponse.json({ success: false, error: keywordError }, { status: 400 });

    const dest = await WebhookDestination.create({
      userId: authed.id,
      whatsappAccountId: account._id,
      label: String(label || 'My project').trim() || 'My project',
      url,
      secret: (WebhookDestination as any).generateSecret(),
      isActive: isActive !== false,
      entryKeyword: normalizedKeyword,
      aliases: normalizedAliases,
      fanoutFallback: Boolean(fanoutFallback),
    });

    return NextResponse.json({ success: true, data: sanitize(dest) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create the webhook destination');
  }
}
