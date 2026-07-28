import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import AppError from '@/lib/utils/AppError';

// Ported from backend/src/controllers/whatsappController.js's deleteAccount
// (also mounted at DELETE /accounts/:id in the original — see
// app/api/whatsapp/accounts/[id]/route.ts for that alias).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  try {
    const authed = await requireAuth(req);
    const { id } = await params;

    const existing: any = await WhatsAppAccount.findOne({ _id: id, userId: authed.id });
    if (!existing) throw new AppError('Account not found', 404);

    const wasActive = Boolean(existing.isActive);
    existing.status = 'disconnected';
    existing.isActive = false;
    existing.numberClaimed = false;
    await existing.save();

    if (wasActive) {
      const fallbackAccount: any = await WhatsAppAccount.findOne({
        userId: authed.id,
        _id: { $ne: existing._id },
        status: { $ne: 'disconnected' },
      }).sort({ updatedAt: -1 });

      if (fallbackAccount) {
        fallbackAccount.isActive = true;
        await fallbackAccount.save();
      }
    }

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'whatsapp_account.delete',
      resource: 'whatsapp_account',
      resourceId: existing._id,
      metadata: { phoneNumberId: existing.phoneNumberId },
    });

    return NextResponse.json({ success: true, message: 'Account removed' });
  } catch (error) {
    return errorResponse(error, 'Failed to remove account');
  }
}
