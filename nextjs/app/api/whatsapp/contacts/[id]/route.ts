import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { forwardToWebhookDestinations } from '@/lib/whatsapp/webhookProcessing';
import { normalizeContactPayload, buildScopedContactFilter } from '@/lib/whatsapp/contacts';
import AppError from '@/lib/utils/AppError';
import Contact from '@/lib/models/Contact';
import logger from '@/lib/utils/logger';

const notifyContactWebhooks = (accountId: unknown, event: string, contact: unknown) => {
  if (!accountId) return;
  forwardToWebhookDestinations(accountId, { event, contact }).catch((err: any) =>
    logger.error('[crm-webhook] contact event fan-out failed:', err.message)
  );
};

// The ownership filter is applied in the query itself, not checked after
// fetching — so an id belonging to another user simply does not match, and the
// 404 is indistinguishable from a non-existent id.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });
    const payload = normalizeContactPayload(await req.json().catch(() => ({})));

    const existing: any = await Contact.findOne({
      $and: [buildScopedContactFilter(authed.id, accountContext), { _id: id }],
    });
    if (!existing) throw new AppError('Contact not found', 404);

    if (payload.phone) existing.phone = payload.phone;
    Object.assign(existing, {
      name: payload.name,
      email: payload.email,
      city: payload.city,
      state: payload.state,
      company: payload.company,
      notes: payload.notes,
      category: payload.category,
      tags: payload.tags,
      assignedAgent: payload.assignedAgent,
      customFields: payload.customFields,
    });
    await existing.save();

    notifyContactWebhooks(accountContext?.account?._id, 'contact.upserted', existing);
    return NextResponse.json({ success: true, data: existing });
  } catch (error) {
    return errorResponse(error, 'Failed to update contact');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });

    const deleted: any = await Contact.findOneAndDelete({
      $and: [buildScopedContactFilter(authed.id, accountContext), { _id: id }],
    });
    if (!deleted) throw new AppError('Contact not found', 404);

    notifyContactWebhooks(accountContext?.account?._id, 'contact.deleted', {
      _id: deleted._id,
      phone: deleted.phone,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to delete contact');
  }
}
