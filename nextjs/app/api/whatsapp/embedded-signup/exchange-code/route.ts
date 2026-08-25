import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { checkUserRateLimit } from '@/lib/http/rateLimit';
import { encryptSensitiveValue } from '@/lib/utils/crypto';
import { getGraphApiVersion } from '@/lib/config/graphApi';
import { upsertAndActivateAccountForUser, subscribeAppToWaba, isMetaNumericId, sanitizeAccount } from '@/lib/whatsapp/connect';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import AppError from '@/lib/utils/AppError';
import logger from '@/lib/utils/logger';

const normalizeWhatsAppApiError = (error: any, fallback: string) => {
  const apiMessage = error?.response?.data?.error?.message;
  return new AppError(apiMessage || fallback, error?.response?.status && error.response.status < 500 ? 400 : 502);
};

// Ported from backend/src/controllers/whatsappController.js's
// completeEmbeddedSignup (exported as completeConnection). Completes
// Meta's WhatsApp Embedded Signup flow: exchanges the OAuth code for a
// token server-side (client secret never touches the browser), then
// resolves phone number details and auto-subscribes the webhook.
export async function POST(req: NextRequest) {
  await connectDB();

  try {
    const authed = await requireAuth(req);

    const allowed = await checkUserRateLimit(authed.id, { windowMs: 5 * 60 * 1000, maxRequests: 10 });
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Rate limit exceeded. Please retry later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { code, wabaId, phoneNumberId, businessId, coexistence } = body || {};

    if (!code) throw new AppError('code is required', 400);
    if (!wabaId || !isMetaNumericId(wabaId)) throw new AppError('wabaId must be a valid Meta WABA ID', 400);
    if (!phoneNumberId || !isMetaNumericId(phoneNumberId)) throw new AppError('phoneNumberId must be a valid Meta phone number ID', 400);
    if (businessId && !isMetaNumericId(businessId)) throw new AppError('businessId must be a valid Meta business ID', 400);

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) throw new AppError('Meta app credentials are not configured on the server', 500);

    const graphVersion = getGraphApiVersion();

    let shortLivedToken: string | undefined;
    try {
      const tokenRes = await axios.get(`https://graph.facebook.com/${graphVersion}/oauth/access_token`, {
        params: { client_id: appId, client_secret: appSecret, code },
        timeout: 15000,
      });
      shortLivedToken = tokenRes.data?.access_token;
    } catch (error) {
      throw normalizeWhatsAppApiError(error, 'Failed to exchange the Meta authorization code for an access token');
    }
    if (!shortLivedToken) throw new AppError('Meta did not return an access token for this authorization code', 502);

    let accessToken = shortLivedToken;
    let expiresIn: number | null = null;
    try {
      const longLivedRes = await axios.get(`https://graph.facebook.com/${graphVersion}/oauth/access_token`, {
        params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortLivedToken },
        timeout: 15000,
      });
      accessToken = longLivedRes.data?.access_token || shortLivedToken;
      expiresIn = longLivedRes.data?.expires_in || null;
    } catch (error: any) {
      logger.warn('[embedded-signup] Long-lived token exchange failed, using short-lived token:', error.message);
    }

    let phoneDetails: any = {};
    try {
      const phoneRes = await axios.get(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}`, {
        params: { fields: 'display_phone_number,verified_name' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      });
      phoneDetails = phoneRes.data || {};
    } catch (error: any) {
      logger.warn('[embedded-signup] Failed to fetch phone number details:', error?.response?.data || error.message);
    }

    const webhookSubscribed = await subscribeAppToWaba({ wabaId, accessToken });

    // A coexistence number stays live in the customer's WhatsApp Business app.
    // The browser reports which Embedded Signup path completed; Meta's own
    // platform_type is fetched separately (an unknown `fields` entry would
    // fail the whole request, and losing display_phone_number matters more)
    // and used to confirm it, so a tampered client flag alone cannot mislabel
    // an ordinary Cloud API number.
    let platformType = '';
    try {
      const platformRes = await axios.get(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}`, {
        params: { fields: 'platform_type' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      });
      platformType = String(platformRes.data?.platform_type || '');
    } catch (error: any) {
      logger.warn('[embedded-signup] Could not read platform_type:', error?.response?.data?.error?.message || error.message);
    }
    const isCoexistence = Boolean(coexistence) || platformType.toUpperCase() === 'SMB_APP';

    const account: any = await upsertAndActivateAccountForUser({
      userId: authed.id,
      phoneNumberId: String(phoneNumberId),
      setPayload: {
        connectionMode: isCoexistence ? 'coexistence' : 'embedded_signup',
        wabaId: String(wabaId),
        businessAccountId: String(businessId || ''),
        displayPhoneNumber: String(phoneDetails.display_phone_number || phoneNumberId),
        verifiedName: String(phoneDetails.verified_name || ''),
        accessTokenEncrypted: encryptSensitiveValue(String(accessToken)),
        tokenType: 'Bearer',
        tokenExpiresAt: expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000) : null,
        status: 'active',
        webhookSubscribed,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        'coexistence.enabled': isCoexistence,
        'coexistence.platformType': platformType,
        // Meta starts streaming `history` shortly after a coexistence number
        // is onboarded — mark it pending so the UI can show "importing chats"
        // rather than an empty inbox.
        ...(isCoexistence ? { 'coexistence.historySyncStatus': 'in_progress' } : {}),
      },
    });

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'whatsapp_account.connect',
      resource: 'whatsapp_account',
      resourceId: account._id,
      metadata: { connectionMode: isCoexistence ? 'coexistence' : 'embedded_signup', phoneNumberId },
    });

    return NextResponse.json({ success: true, data: sanitizeAccount(account) });
  } catch (error) {
    return errorResponse(error, 'Failed to complete embedded signup');
  }
}
