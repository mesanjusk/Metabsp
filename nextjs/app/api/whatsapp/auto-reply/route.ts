import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { normalizeAutoReplyPayload, ownedAutoReplyFilter, unownedAutoReplyFilter } from '@/lib/whatsapp/automation';
import AutoReply from '@/lib/models/AutoReply';

// Ported from backend/src/controllers/whatsappController.js.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });

    let data: any[] = await AutoReply.find(ownedAutoReplyFilter(authed.id, accountContext))
      .sort({ createdAt: -1 })
      .lean();

    // Falls back to unowned legacy rules only when the user has none of their
    // own — these predate per-account ownership and would otherwise disappear.
    //
    // No `{ userId: '' }` clause: userId is an ObjectId, so Mongoose cannot
    // cast an empty string and throws CastError instead of matching nothing.
    // It could never have matched a row either — an empty string is not
    // storable in that field — so the clause did nothing but turn this branch
    // into a 500. And this is the branch a brand-new account always takes,
    // which made the auto-reply screen fail for exactly the users who had
    // never used it.
    if (!data.length) {
      data = await AutoReply.find(unownedAutoReplyFilter()).sort({ createdAt: -1 }).lean();
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to load auto reply rules');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });
    const payload = normalizeAutoReplyPayload(await req.json().catch(() => ({})));

    const rule = await AutoReply.create({
      ...payload,
      userId: authed.id,
      whatsappAccountId: accountContext?.account?._id,
    });

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create auto reply rule');
  }
}
