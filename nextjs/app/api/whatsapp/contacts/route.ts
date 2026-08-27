import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { normalizeContactPayload, buildScopedContactFilter, buildContactListFilter } from '@/lib/whatsapp/contacts';
import AppError from '@/lib/utils/AppError';
import Contact from '@/lib/models/Contact';
import logger from '@/lib/utils/logger';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });
    const page = Math.max(1, parseInt(searchParams.get('page') || '', 10) || 1);
    const limit = Math.min(5000, Math.max(1, parseInt(searchParams.get('limit') || '', 10) || 50));
    const skip = (page - 1) * limit;

    const scope = buildScopedContactFilter(authed.id, accountContext);
    const filter = buildContactListFilter(scope, {
      search: String(searchParams.get('search') || '').trim(),
      category: String(searchParams.get('category') || '').trim(),
      tag: String(searchParams.get('tag') || '').trim(),
    });

    const [data, total, categories] = await Promise.all([
      Contact.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Contact.countDocuments(filter),
      Contact.distinct('category', scope).then((cats: any[]) => cats.filter(Boolean).sort()),
    ]);

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      categories,
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load contacts');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });
    const payload = normalizeContactPayload(await req.json().catch(() => ({})));
    if (!payload.phone) throw new AppError('Phone is required', 400);

    const data = await Contact.findOneAndUpdate(
      { userId: authed.id, phone: payload.phone },
      { $set: { ...payload, userId: authed.id, whatsappAccountId: accountContext?.account?._id || null } },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create contact');
  }
}
