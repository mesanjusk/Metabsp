import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { sanitizeAccount } from '@/lib/whatsapp/connect';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import AppError from '@/lib/utils/AppError';

// Ported from backend/src/controllers/whatsappController.js's disconnectAccount.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  try {
    const authed = await requireAuth(req);
    const { id } = await params;

    const existing: any = await WhatsAppAccount.findOne({ _id: id, userId: authed.id });
    if (!existing) throw new AppError('Account not found', 404);

    existing.status = 'disconnected';
    existing.isActive = false;
    existing.webhookSubscribed = false;
    existing.numberClaimed = false;
    await existing.save();

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'whatsapp_account.disconnect',
      resource: 'whatsapp_account',
      resourceId: existing._id,
      metadata: { phoneNumberId: existing.phoneNumberId },
    });

    return NextResponse.json({ success: true, data: sanitizeAccount(existing) });
  } catch (error) {
    return errorResponse(error, 'Failed to disconnect account');
  }
}
