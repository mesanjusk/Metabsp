import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { decryptSensitiveValue } from '@/lib/utils/crypto';
import { checkWhatsAppHealth } from '@/lib/services/whatsappHealthService';
import { getGraphApiVersion } from '@/lib/config/graphApi';
import { sanitizeAccount } from '@/lib/whatsapp/connect';
import AppError from '@/lib/utils/AppError';

// Ported from backend/src/controllers/whatsappController.js's revalidateAccount.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const existing: any = await WhatsAppAccount.findOne({ _id: id, userId: authed.id });
    if (!existing) throw new AppError('Account not found', 404);

    const accountContext = {
      accessToken: decryptSensitiveValue(existing.accessTokenEncrypted),
      phoneNumberId: String(existing.phoneNumberId || ''),
      graphVersion: getGraphApiVersion(),
    };
    const health = await checkWhatsAppHealth(accountContext);

    existing.status = health.isConnected ? 'active' : 'error';
    existing.lastSyncAt = new Date();
    await existing.save();

    return NextResponse.json({ success: true, data: sanitizeAccount(existing), validation: health });
  } catch (error) {
    return errorResponse(error, 'Failed to revalidate account');
  }
}
