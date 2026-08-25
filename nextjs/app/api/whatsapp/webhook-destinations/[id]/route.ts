import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WebhookDestination from '@/lib/models/WebhookDestination';
import {
  validateUrl,
  validateKeywords,
  normalizeKeyword,
  normalizeAliases,
  sanitize,
} from '@/lib/whatsapp/webhookDestinations';

// Ported from backend/src/routes/webhookDestinations.js.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const { label, url, isActive, entryKeyword, aliases, fanoutFallback } = body || {};

    if (url !== undefined) {
      const urlError = validateUrl(url);
      if (urlError) return NextResponse.json({ success: false, error: urlError }, { status: 400 });
    }

    const update: any = {};
    if (label !== undefined) update.label = String(label).trim() || 'My project';
    if (url !== undefined) update.url = url;
    if (isActive !== undefined) update.isActive = Boolean(isActive);
    if (fanoutFallback !== undefined) update.fanoutFallback = Boolean(fanoutFallback);

    if (entryKeyword !== undefined || aliases !== undefined) {
      const existing: any = await WebhookDestination.findOne({ _id: id, userId: authed.id });
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Webhook destination not found' }, { status: 404 });
      }

      const normalizedKeyword =
        entryKeyword !== undefined ? normalizeKeyword(entryKeyword) : normalizeKeyword(existing.entryKeyword);
      const normalizedAliases =
        aliases !== undefined ? normalizeAliases(aliases) : normalizeAliases(existing.aliases);

      const keywordError = await validateKeywords({
        entryKeyword: normalizedKeyword,
        aliases: normalizedAliases,
        whatsappAccountId: existing.whatsappAccountId,
        excludeId: existing._id,
      });
      if (keywordError) return NextResponse.json({ success: false, error: keywordError }, { status: 400 });

      update.entryKeyword = normalizedKeyword;
      update.aliases = normalizedAliases;
    }

    const dest = await WebhookDestination.findOneAndUpdate(
      { _id: id, userId: authed.id },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!dest) {
      return NextResponse.json({ success: false, error: 'Webhook destination not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: sanitize(dest) });
  } catch (error) {
    return errorResponse(error, 'Failed to update the webhook destination');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const deleted = await WebhookDestination.findOneAndDelete({ _id: id, userId: authed.id });
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Webhook destination not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Webhook destination deleted' });
  } catch (error) {
    return errorResponse(error, 'Failed to delete the webhook destination');
  }
}
