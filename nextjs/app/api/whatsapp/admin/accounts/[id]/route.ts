import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { decryptSensitiveValue } from '@/lib/utils/crypto';
import { getGraphApiVersion } from '@/lib/config/graphApi';
import { assertIsWhatsAppBusinessAccount } from '@/lib/services/whatsappCredentialValidationService';
import { subscribeAppToWaba } from '@/lib/whatsapp/connect';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import AppError from '@/lib/utils/AppError';
import logger from '@/lib/utils/logger';

/**
 * Repair or remove one WhatsApp account by its own id, whoever owns it.
 *
 * Addressed by account rather than by user on purpose. The per-user routes
 * scope every query to `userId`, which cannot reach a row whose owner is gone
 * or whose owner is not the one you happen to be looking at — and those are
 * the rows that cause trouble, because inbound webhooks resolve a number
 * across all accounts regardless of who holds it.
 */

/**
 * PATCH — correct the WABA id, and subscribe the app to it.
 *
 * The two belong together. A corrected id that is never subscribed changes
 * nothing observable: sends already worked, and inbound still would not
 * arrive. Doing both here means one action has one outcome.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const { id } = await params;
    const account: any = await WhatsAppAccount.findById(id);
    if (!account) throw new AppError('Account not found', 404);

    const body = await req.json().catch(() => ({}));
    const wabaId = String(body?.wabaId || '').trim();
    if (!wabaId) throw new AppError('wabaId is required', 400);

    const graphVersion = getGraphApiVersion();
    let accessToken = '';
    try {
      accessToken = account.accessTokenEncrypted ? decryptSensitiveValue(account.accessTokenEncrypted) : '';
    } catch (_error) {
      throw new AppError('Stored access token could not be decrypted — check WHATSAPP_TOKEN_ENCRYPTION_KEY', 500);
    }

    // Refuse an id that is not a WABA before storing it. This is the check
    // that would have stopped a Meta App ID being saved here in the first
    // place; it throws on the node-type error and stays quiet about anything
    // it merely could not confirm.
    let verified = false;
    if (accessToken) {
      const check = await assertIsWhatsAppBusinessAccount({ id: wabaId, accessToken, graphVersion });
      verified = check.verified;
    }

    const previousWabaId = String(account.wabaId || '');
    account.wabaId = wabaId;
    if (String(body?.businessAccountId || '').trim()) {
      account.businessAccountId = String(body.businessAccountId).trim();
    }

    const subscribed = accessToken ? await subscribeAppToWaba({ wabaId, accessToken }) : false;
    account.webhookSubscribed = subscribed;
    account.lastSyncAt = new Date();
    await account.save();

    logger.info(
      `[admin] Account ${account._id} (phone_number_id ${account.phoneNumberId}) WABA ${previousWabaId || 'none'} -> ${wabaId}; ` +
        `verified=${verified} subscribed=${subscribed}`
    );

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'whatsapp_account.repair',
      resource: 'whatsapp_account',
      resourceId: account._id,
      metadata: { phoneNumberId: account.phoneNumberId, previousWabaId, wabaId, verified, subscribed },
    });

    return NextResponse.json({
      success: true,
      data: { id: String(account._id), wabaId, webhookSubscribed: subscribed },
      message: subscribed
        ? 'WABA id updated and this app is now subscribed to it — inbound messages should arrive.'
        : 'WABA id updated, but subscribing this app to it failed. Check the server log for Meta’s reason.',
    });
  } catch (error) {
    return errorResponse(error, 'Failed to repair account');
  }
}

/**
 * DELETE — remove one account row, whoever owns it.
 *
 * Deliberately not scoped to the caller: the row worth deleting is usually the
 * one that answers for a number it should not, and it belongs to somebody
 * else or to nobody.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const { id } = await params;
    const account: any = await WhatsAppAccount.findById(id).select('_id phoneNumberId wabaId userId').lean();
    if (!account) throw new AppError('Account not found', 404);

    await WhatsAppAccount.deleteOne({ _id: account._id });

    logger.info(
      `[admin] Deleted WhatsApp account ${account._id}: phone_number_id ${account.phoneNumberId || 'none'} / ` +
        `WABA ${account.wabaId || 'none'} (owner ${account.userId || 'none'})`
    );

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'whatsapp_account.admin_delete',
      resource: 'whatsapp_account',
      resourceId: account._id,
      metadata: { phoneNumberId: account.phoneNumberId, wabaId: account.wabaId, ownerUserId: String(account.userId || '') },
    });

    return NextResponse.json({ success: true, message: 'WhatsApp account removed.' });
  } catch (error) {
    return errorResponse(error, 'Failed to delete account');
  }
}
