import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { checkUserRateLimit } from '@/lib/http/rateLimit';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { encryptSensitiveValue, decryptSensitiveValue } from '@/lib/utils/crypto';
import { validateManualWhatsAppCredentials } from '@/lib/services/whatsappCredentialValidationService';
import { assertPhoneNumberAvailable } from '@/lib/services/whatsappAccountService';
import { sanitizeAccount } from '@/lib/whatsapp/connect';
import AppError from '@/lib/utils/AppError';

// Ported from backend/src/controllers/whatsappController.js's updateManualAccount.
// Every field falls back to what is already stored, so a partial update (say,
// rotating only the access token) does not blank out the rest of the account.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const allowed = await checkUserRateLimit(authed.id, { windowMs: 5 * 60 * 1000, maxRequests: 10 });
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Rate limit exceeded. Please retry later.' }, { status: 429 });
    }

    const { id } = await params;
    const existing: any = await WhatsAppAccount.findOne({ _id: id, userId: authed.id });
    if (!existing) throw new AppError('Account not found', 404);
    if (existing.connectionMode !== 'manual') {
      throw new AppError('Only manual accounts can be updated here', 400);
    }

    const body = await req.json().catch(() => ({}));
    const {
      accessToken,
      phoneNumberId,
      businessAccountId,
      wabaId,
      displayPhoneNumber,
      verifiedName,
      accountName,
      label,
    } = body || {};

    const resolvedAccessToken =
      String(accessToken || '').trim() ||
      (existing.accessTokenEncrypted ? decryptSensitiveValue(existing.accessTokenEncrypted) : '');
    const resolvedPhoneNumberId = String(phoneNumberId || existing.phoneNumberId || '').trim();
    const resolvedBusinessAccountId = String(businessAccountId || existing.businessAccountId || '').trim();
    const resolvedWabaId = String(wabaId || existing.wabaId || '').trim();

    if (!resolvedAccessToken || !resolvedPhoneNumberId || (!resolvedBusinessAccountId && !resolvedWabaId)) {
      throw new AppError('accessToken, phoneNumberId and businessAccountId or wabaId are required', 400);
    }

    const validated: any = await validateManualWhatsAppCredentials({
      accessToken: resolvedAccessToken,
      phoneNumberId: resolvedPhoneNumberId,
      businessAccountId: resolvedBusinessAccountId,
      wabaId: resolvedWabaId,
    });

    const newPhoneNumberId = String(validated.phoneNumberId || resolvedPhoneNumberId);
    if (newPhoneNumberId !== existing.phoneNumberId) {
      await assertPhoneNumberAvailable({
        phoneNumberId: newPhoneNumberId,
        userId: authed.id,
        excludeAccountId: existing._id,
      });
    }

    existing.phoneNumberId = newPhoneNumberId;
    existing.businessAccountId = String(validated.businessAccountId || resolvedBusinessAccountId);
    existing.wabaId = String(validated.wabaId || resolvedWabaId);
    existing.displayPhoneNumber = String(
      validated.displayPhoneNumber || displayPhoneNumber || existing.displayPhoneNumber || existing.phoneNumberId
    );
    existing.verifiedName = String(validated.verifiedName || verifiedName || existing.verifiedName || '');
    existing.accessTokenEncrypted = encryptSensitiveValue(resolvedAccessToken);
    existing.appScopedMetaUserId = String(validated.appScopedMetaUserId || existing.appScopedMetaUserId || '');
    existing.status = 'active';
    existing.numberClaimed = true;
    existing.lastSyncAt = new Date();
    existing.metadata = {
      ...(existing.metadata || {}),
      ...(validated.metadata || {}),
      accountName: String(accountName || label || existing.metadata?.accountName || ''),
    };

    try {
      await existing.save();
    } catch (error: any) {
      // The partial unique index on phoneNumberId is the real guard;
      // assertPhoneNumberAvailable above only turns the common case into a
      // readable message. A racing write still lands here.
      if (error?.code === 11000) {
        throw new AppError('This WhatsApp number is already connected to a different account.', 409);
      }
      throw error;
    }

    return NextResponse.json({ success: true, data: sanitizeAccount(existing) });
  } catch (error) {
    return errorResponse(error, 'Failed to update the manual account');
  }
}
