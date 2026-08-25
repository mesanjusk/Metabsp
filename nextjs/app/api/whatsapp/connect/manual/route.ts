import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { checkUserRateLimit } from '@/lib/http/rateLimit';
import { encryptSensitiveValue } from '@/lib/utils/crypto';
import { validateManualWhatsAppCredentials } from '@/lib/services/whatsappCredentialValidationService';
import { upsertAndActivateAccountForUser, subscribeAppToWaba, sanitizeAccount } from '@/lib/whatsapp/connect';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import AppError from '@/lib/utils/AppError';

// Ported from backend/src/controllers/whatsappController.js's manualConnect.
export async function POST(req: NextRequest) {

  try {
    await connectDB();
    const authed = await requireAuth(req);

    const allowed = await checkUserRateLimit(authed.id, { windowMs: 5 * 60 * 1000, maxRequests: 10 });
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Rate limit exceeded. Please retry later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { accessToken, phoneNumberId, businessAccountId, wabaId, displayPhoneNumber, verifiedName, tokenType, expiresIn, accountName, label } =
      body || {};

    if (!accessToken || !phoneNumberId || (!businessAccountId && !wabaId)) {
      throw new AppError('accessToken, phoneNumberId and businessAccountId or wabaId are required', 400);
    }

    const validated = await validateManualWhatsAppCredentials({ accessToken, phoneNumberId, businessAccountId, wabaId });

    const normalizedPhoneNumberId = String(validated.phoneNumberId || phoneNumberId);
    const resolvedWabaId = String(validated.wabaId || wabaId || '');

    const webhookSubscribed = resolvedWabaId ? await subscribeAppToWaba({ wabaId: resolvedWabaId, accessToken }) : false;

    const account: any = await upsertAndActivateAccountForUser({
      userId: authed.id,
      phoneNumberId: normalizedPhoneNumberId,
      setPayload: {
        connectionMode: 'manual',
        wabaId: resolvedWabaId,
        businessAccountId: String(validated.businessAccountId || businessAccountId || ''),
        displayPhoneNumber: String(validated.displayPhoneNumber || displayPhoneNumber || normalizedPhoneNumberId),
        verifiedName: String(validated.verifiedName || verifiedName || ''),
        accessTokenEncrypted: encryptSensitiveValue(String(accessToken)),
        tokenType: String(tokenType || validated.tokenType || 'Bearer'),
        tokenExpiresAt: expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000) : null,
        appScopedMetaUserId: String(validated.appScopedMetaUserId || ''),
        status: 'active',
        webhookSubscribed,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        metadata: { ...(validated.metadata || {}), accountName: String(accountName || label || '') },
      },
    });

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'whatsapp_account.connect',
      resource: 'whatsapp_account',
      resourceId: account._id,
      metadata: { connectionMode: 'manual', phoneNumberId: normalizedPhoneNumberId },
    });

    return NextResponse.json({ success: true, data: sanitizeAccount(account) });
  } catch (error) {
    return errorResponse(error, 'Failed to connect WhatsApp account');
  }
}
