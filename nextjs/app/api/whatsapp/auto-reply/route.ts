import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { normalizeAutoReplyPayload } from '@/lib/whatsapp/automation';
import AutoReply from '@/lib/models/AutoReply';

// Ported from backend/src/controllers/whatsappController.js.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });

    const scopedFilter = {
      userId: authed.id,
      ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}),
    };

    let data: any[] = await AutoReply.find(scopedFilter).sort({ createdAt: -1 }).lean();

    // Falls back to unowned legacy rules only when the user has none of their
    // own — these predate per-account ownership and would otherwise disappear.
    if (!data.length) {
      data = await AutoReply.find({
        $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }],
      })
        .sort({ createdAt: -1 })
        .lean();
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
