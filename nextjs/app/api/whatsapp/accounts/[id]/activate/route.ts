import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { assertPhoneNumberAvailable } from '@/lib/services/whatsappAccountService';
import { sanitizeAccount } from '@/lib/whatsapp/connect';
import AppError from '@/lib/utils/AppError';

// Ported from backend/src/controllers/whatsappController.js's activateAccount.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const account: any = await WhatsAppAccount.findOne({ _id: id, userId: authed.id });
    if (!account) throw new AppError('Account not found', 404);

    const wasDisconnected = account.status === 'disconnected';
    if (wasDisconnected) {
      await assertPhoneNumberAvailable({ phoneNumberId: account.phoneNumberId, userId: authed.id, excludeAccountId: account._id });
    }

    await WhatsAppAccount.updateMany({ userId: authed.id, _id: { $ne: account._id } }, { $set: { isActive: false } });

    let updated;
    try {
      updated = await WhatsAppAccount.findOneAndUpdate(
        { _id: account._id, userId: authed.id },
        { $set: { isActive: true, numberClaimed: true, ...(wasDisconnected ? { status: 'active' } : {}) } },
        { new: true }
      );
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new AppError('This WhatsApp number is already connected to a different account.', 409);
      }
      throw error;
    }

    if (!updated) throw new AppError('Account not found', 404);

    return NextResponse.json({ success: true, data: sanitizeAccount(updated) });
  } catch (error) {
    return errorResponse(error, 'Failed to activate account');
  }
}
