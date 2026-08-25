import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { checkWhatsAppHealth } from '@/lib/services/whatsappHealthService';
import { sanitizeAccount } from '@/lib/whatsapp/connect';

// Ported from backend/src/controllers/whatsappController.js's getStatus.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const accountContext = await resolveCurrentWhatsAppAccountForUser(authed.id);
    const health = await checkWhatsAppHealth(accountContext);
    const accounts = await WhatsAppAccount.find({ userId: authed.id })
      .select('_id phoneNumberId displayPhoneNumber verifiedName status isActive')
      .lean();

    return NextResponse.json({
      success: true,
      status: health.isConnected ? 'connected' : 'disconnected',
      data: accounts.map((account: any) => ({ ...sanitizeAccount(account), displayName: account.displayPhoneNumber || account.phoneNumberId })),
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load status');
  }
}
