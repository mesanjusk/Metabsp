import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { normalizeAutoReplyPayload, autoReplyScopeFilter } from '@/lib/whatsapp/automation';
import AppError from '@/lib/utils/AppError';
import AutoReply from '@/lib/models/AutoReply';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });
    const payload = normalizeAutoReplyPayload(await req.json().catch(() => ({})));

    const rule = await AutoReply.findOneAndUpdate(
      { _id: id, ...autoReplyScopeFilter(authed.id, accountContext) },
      { ...payload, userId: authed.id, whatsappAccountId: accountContext?.account?._id },
      { new: true }
    );
    if (!rule) throw new AppError('Auto reply rule not found', 404);

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    return errorResponse(error, 'Failed to update auto reply rule');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });

    const deleted = await AutoReply.findOneAndDelete({
      _id: id,
      ...autoReplyScopeFilter(authed.id, accountContext),
    });
    if (!deleted) throw new AppError('Auto reply rule not found', 404);

    return NextResponse.json({ success: true, message: 'Rule deleted' });
  } catch (error) {
    return errorResponse(error, 'Failed to delete auto reply rule');
  }
}
