import axios from 'axios';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { checkUserRateLimit } from '@/lib/http/rateLimit';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { decryptSensitiveValue } from '@/lib/utils/crypto';
import { getGraphApiVersion } from '@/lib/config/graphApi';
import { sanitizeAccount } from '@/lib/whatsapp/connect';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import AppError from '@/lib/utils/AppError';

/**
 * Register one connected number on the WhatsApp Cloud API.
 *
 * A number added to a WABA stays "pending" until it is registered for Cloud
 * API use — until then every send is rejected with Meta error 133010
 * ("Account not registered"). Registration is a one-time POST to
 * /{phone-number-id}/register carrying the number's 6-digit two-step
 * verification PIN (which this call sets if two-step was never enabled).
 *
 * This puts that step behind a button so an operator never has to reach for
 * Graph API Explorer: the number's stored access token is reused, and Meta's
 * own error is surfaced verbatim (wrong PIN -> 133005, re-verification needed
 * -> 133006, number still on the consumer app, ...) so they know exactly what
 * to fix rather than seeing a generic failure.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const allowed = await checkUserRateLimit(authed.id, { windowMs: 60 * 1000, maxRequests: 10 });
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Rate limit exceeded. Please retry later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const pin = String(body?.pin || '').trim();
    // Meta requires a 6-digit numeric PIN; reject anything else before spending
    // a Graph round trip on it.
    if (!/^\d{6}$/.test(pin)) throw new AppError('A 6-digit PIN is required to register the number', 400);

    const existing: any = await WhatsAppAccount.findOne({ _id: id, userId: authed.id });
    if (!existing) throw new AppError('Account not found', 404);

    const accessToken = decryptSensitiveValue(existing.accessTokenEncrypted);
    const phoneNumberId = String(existing.phoneNumberId || '');
    if (!accessToken || !phoneNumberId) {
      throw new AppError('This number has no stored access token or phone number id — reconnect it first', 400);
    }

    let data: any;
    try {
      const response = await axios.post(
        `https://graph.facebook.com/${getGraphApiVersion()}/${phoneNumberId}/register`,
        { messaging_product: 'whatsapp', pin },
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      data = response?.data;
    } catch (error: any) {
      // Surface Meta's own message: it names the real blocker (PIN mismatch,
      // re-verification, a number still attached to the WhatsApp Business app)
      // in a way the operator can act on. A Graph 4xx is the caller's problem
      // to fix (400); a 5xx/timeout is upstream (502).
      const apiMessage = error?.response?.data?.error?.message;
      const status = error?.response?.status && error.response.status < 500 ? 400 : 502;
      throw new AppError(apiMessage || 'Failed to register the number with WhatsApp', status);
    }

    // A registered number can send: it is no longer "pending".
    existing.status = 'active';
    existing.lastSyncAt = new Date();
    existing.metadata = { ...(existing.metadata || {}), registeredAt: new Date() };
    existing.markModified('metadata');
    await existing.save();

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'whatsapp_account.register',
      resource: 'whatsapp_account',
      resourceId: existing._id,
      metadata: { phoneNumberId },
    });

    return NextResponse.json({ success: true, data, account: sanitizeAccount(existing) });
  } catch (error) {
    return errorResponse(error, 'Failed to register the number');
  }
}
