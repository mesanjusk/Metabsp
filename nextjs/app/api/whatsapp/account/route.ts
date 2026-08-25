import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { loadActiveWhatsAppAccountForUser } from '@/lib/services/whatsappAccountService';
import { sanitizeAccount } from '@/lib/whatsapp/connect';

// Ported from backend/src/controllers/whatsappController.js's getAccount.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const active: any = await loadActiveWhatsAppAccountForUser(authed.id, { requireAccount: false });
    if (!active) {
      return NextResponse.json({ success: true, data: null });
    }

    if (active.source === 'legacy-env') {
      return NextResponse.json({
        success: true,
        data: {
          source: 'legacy-env',
          phoneNumberId: active.phoneNumberId || '',
          displayPhoneNumber: active.displayPhoneNumber || '',
          wabaId: active.wabaId || '',
          businessAccountId: active.businessAccountId || '',
          status: active.status || 'active',
        },
      });
    }

    return NextResponse.json({ success: true, data: sanitizeAccount(active.account) });
  } catch (error) {
    return errorResponse(error, 'Failed to load account');
  }
}
