import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import {
  checkWhatsAppHealth,
  isDefinitiveWhatsAppDisconnectReason,
} from '@/lib/services/whatsappHealthService';
import { sanitizeAccount } from '@/lib/whatsapp/connect';

// Ported from backend/src/controllers/whatsappController.js's getStatus.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    // A status poll must always answer — a user with no connected account is
    // "disconnected", not a 404. Requiring an account here turned every poll
    // from such a user into a 404 (and a noisy console error) instead of the
    // disconnected state the UI is asking for.
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });
    const health = accountContext
      ? await checkWhatsAppHealth(accountContext)
      : { isConnected: false, reason: 'NO_ACCOUNT' as const };

    let reconciled = false;

    // A customer can remove the WhatsApp asset / business integration directly
    // in Meta. That happens outside SanjuSK, so our database row does not get a
    // local DELETE request. The health poll is the reliable reconciliation
    // point: only persist a disconnect for definitive authorization/object-
    // access failures, never for a timeout or Meta 5xx.
    if (
      accountContext?.source === 'database' &&
      accountContext?.account?._id &&
      !health.isConnected &&
      isDefinitiveWhatsAppDisconnectReason(health.reason)
    ) {
      const now = new Date();
      const result = await WhatsAppAccount.updateOne(
        { _id: accountContext.account._id, userId: authed.id, status: { $ne: 'disconnected' } },
        {
          $set: {
            status: 'disconnected',
            isActive: false,
            numberClaimed: false,
            webhookSubscribed: false,
            lastSyncAt: now,
            'metadata.metaDisconnectedAt': now,
            'metadata.metaDisconnectReason': String(health.reason || 'ACCESS_REVOKED'),
          },
        }
      );
      reconciled = Number(result.modifiedCount || 0) > 0;
    }

    const accounts = await WhatsAppAccount.find({ userId: authed.id })
      .select('_id phoneNumberId displayPhoneNumber verifiedName status isActive')
      .lean();

    return NextResponse.json({
      success: true,
      status: health.isConnected ? 'connected' : 'disconnected',
      reason: health.reason || null,
      reconciled,
      data: accounts.map((account: any) => ({
        ...sanitizeAccount(account),
        displayName: account.displayPhoneNumber || account.phoneNumberId,
      })),
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load status');
  }
}
