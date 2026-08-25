import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { buildScopedContactFilter } from '@/lib/whatsapp/contacts';
import AppError from '@/lib/utils/AppError';
import Contact from '@/lib/models/Contact';

// Bulk category/tag update. The scope filter is ANDed into the updateMany
// query, so ids belonging to another user match nothing rather than being
// updated — the ids come from the client and are never trusted on their own.
export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { ids, category, tags } = (await req.json().catch(() => ({}))) as any;

    if (!Array.isArray(ids) || !ids.length) throw new AppError('ids must be a non-empty array', 400);

    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });
    const scopeFilter = buildScopedContactFilter(authed.id, accountContext);

    const update: Record<string, unknown> = {};
    if (category !== undefined) update.category = String(category || '').trim();
    if (Array.isArray(tags)) update.tags = tags.map((t: unknown) => String(t).trim()).filter(Boolean);
    if (!Object.keys(update).length) throw new AppError('Provide category or tags to update', 400);

    const result = await Contact.updateMany({ _id: { $in: ids }, ...scopeFilter }, { $set: update });
    return NextResponse.json({ success: true, modified: result.modifiedCount });
  } catch (error) {
    return errorResponse(error, 'Failed to update contacts');
  }
}
