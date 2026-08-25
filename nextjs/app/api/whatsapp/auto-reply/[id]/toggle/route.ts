import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import AppError from '@/lib/utils/AppError';
import AutoReply from '@/lib/models/AutoReply';

// Toggle scopes strictly by userId (no legacy-unowned fallback) — matching the
// Express behaviour: a rule nobody owns should not be flippable by any caller.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });

    const current: any = await AutoReply.findOne({
      _id: id,
      userId: authed.id,
      ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}),
    });
    if (!current) throw new AppError('Auto reply rule not found', 404);

    current.isActive = !current.isActive;
    await current.save();

    return NextResponse.json({ success: true, data: current });
  } catch (error) {
    return errorResponse(error, 'Failed to toggle auto reply rule');
  }
}
