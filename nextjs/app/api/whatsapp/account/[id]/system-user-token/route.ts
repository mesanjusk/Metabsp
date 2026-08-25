import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { checkUserRateLimit } from '@/lib/http/rateLimit';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { encryptSensitiveValue } from '@/lib/utils/crypto';
import { checkWhatsAppHealth } from '@/lib/services/whatsappHealthService';
import { getGraphApiVersion } from '@/lib/config/graphApi';
import { sanitizeAccount } from '@/lib/whatsapp/connect';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import AppError from '@/lib/utils/AppError';

// Ported from backend/src/controllers/whatsappController.js's setSystemUserToken.
//
// Meta's own guidance for BSPs is a Business-owned System User token
// (generated manually in Meta Business Manager, typically set to never
// expire) rather than a token tied to an individual admin's personal login.
// There's no API to auto-generate one — the admin pastes a token they already
// generated in Business Manager, and this verifies it actually works against
// the connected phone number before switching the account over to it.
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

    const body = await req.json().catch(() => ({}));
    const accessToken = String(body?.accessToken || '').trim();
    const systemUserId = String(body?.systemUserId || '').trim();
    if (!accessToken) throw new AppError('accessToken is required', 400);

    const health = await checkWhatsAppHealth({
      accessToken,
      phoneNumberId: existing.phoneNumberId,
      graphVersion: getGraphApiVersion(),
    });
    if (!health.isConnected) {
      throw new AppError('Could not verify this token against the connected phone number', 400);
    }

    existing.accessTokenEncrypted = encryptSensitiveValue(accessToken);
    existing.tokenSource = 'system_user';
    existing.systemUserId = systemUserId;
    // Clearing this also removes the account from tokenRefreshService's
    // re-exchange candidates (belt-and-suspenders alongside its own
    // tokenSource filter) — System User tokens aren't refreshed that way.
    existing.tokenExpiresAt = null;
    existing.status = 'active';
    await existing.save();

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'whatsapp_account.system_user_token_set',
      resource: 'whatsapp_account',
      resourceId: existing._id,
    });

    return NextResponse.json({ success: true, data: sanitizeAccount(existing) });
  } catch (error) {
    return errorResponse(error, 'Failed to set the system user token');
  }
}
