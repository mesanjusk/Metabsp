import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { checkUserRateLimit } from '@/lib/http/rateLimit';
import { encryptSensitiveValue } from '@/lib/utils/crypto';
import { getGraphApiVersion } from '@/lib/config/graphApi';
import { upsertAndActivateAccountForUser, subscribeAppToWaba, isMetaNumericId, sanitizeAccount } from '@/lib/whatsapp/connect';
import {
  debugToken,
  validateTokenDebugData,
  resolveWabaId,
  fetchWabaPhoneNumbers,
  selectOnboardedPhone,
  isCoexistenceNumber,
  logOnboardingResolution,
} from '@/lib/whatsapp/metaOnboarding';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import AppError from '@/lib/utils/AppError';
import logger from '@/lib/utils/logger';

const normalizeWhatsAppApiError = (error: any, fallback: string) => {
  const apiMessage = error?.response?.data?.error?.message;
  return new AppError(apiMessage || fallback, error?.response?.status && error.response.status < 500 ? 400 : 502);
};

/**
 * Completes Meta's WhatsApp Embedded Signup v4 flow.
 *
 * The browser posts back a WABA id, an optional phone number id, an optional
 * business id and a coexistence hint; FB.login itself returns only the OAuth
 * `code`. This handler treats every one of those browser values as a hint and
 * re-derives the truth server-side (see docs/meta-tech-provider/COEXISTENCE.md
 * § Embedded Signup v4):
 *
 *   1. Exchange the code for the Business Integration System User (BISU) token.
 *      For a v4 configuration this is already the long-lived business token, so
 *      the old fb_exchange_token step is intentionally NOT run — it does not
 *      apply to a business-integration token and only added a way to fail.
 *   2. debug_token: confirm the token is valid, belongs to THIS Meta app, and
 *      carries the required WhatsApp scopes; read the WABA ids it actually
 *      grants from its granular scopes.
 *   3. Resolve the WABA id from the browser hint cross-checked against the
 *      token, then discover the WABA's phone numbers and select the onboarded
 *      one — never trusting a browser-supplied phone number that the WABA does
 *      not actually contain, and refusing rather than guessing when ambiguous.
 *   4. Subscribe this app to the customer's WABA and persist the account with
 *      the token encrypted at rest.
 *
 * The client secret never reaches the browser, and the access token, code and
 * secret are never logged.
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const allowed = await checkUserRateLimit(authed.id, { windowMs: 5 * 60 * 1000, maxRequests: 10 });
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Rate limit exceeded. Please retry later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { code, wabaId, phoneNumberId, businessId, coexistence } = body || {};

    if (!code) throw new AppError('code is required', 400);
    // wabaId and phoneNumberId are hints now: a coexistence completion can omit
    // the phone number id, and the WABA id is re-derived from the token when the
    // browser does not supply one. Validate the SHAPE of anything present, but
    // do not require it.
    if (wabaId && !isMetaNumericId(wabaId)) throw new AppError('wabaId must be a valid Meta WABA ID', 400);
    if (phoneNumberId && !isMetaNumericId(phoneNumberId)) throw new AppError('phoneNumberId must be a valid Meta phone number ID', 400);
    if (businessId && !isMetaNumericId(businessId)) throw new AppError('businessId must be a valid Meta business ID', 400);

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) throw new AppError('Meta app credentials are not configured on the server', 500);

    const graphVersion = getGraphApiVersion();

    // ── 1. Code → Business Integration System User token ───────────────────────
    let accessToken: string | undefined;
    let codeExchangeExpiresIn: number | null = null;
    try {
      const tokenRes = await axios.get(`https://graph.facebook.com/${graphVersion}/oauth/access_token`, {
        params: { client_id: appId, client_secret: appSecret, code },
        timeout: 15000,
      });
      accessToken = tokenRes.data?.access_token;
      codeExchangeExpiresIn = Number(tokenRes.data?.expires_in) || null;
    } catch (error) {
      throw normalizeWhatsAppApiError(error, 'Failed to exchange the Meta authorization code for an access token');
    }
    if (!accessToken) throw new AppError('Meta did not return an access token for this authorization code', 502);

    // ── 2. Validate the token against THIS app + required scopes ───────────────
    const debugData = await debugToken({ token: accessToken, appId, appSecret, graphVersion });
    const validation = validateTokenDebugData(debugData, { expectedAppId: appId });

    // ── 3. Resolve WABA + phone number server-side ─────────────────────────────
    const resolvedWabaId = resolveWabaId({ reported: wabaId, wabaTargetIdsByScope: validation.wabaTargetIdsByScope });

    const candidates = await fetchWabaPhoneNumbers({ wabaId: resolvedWabaId, accessToken, graphVersion });
    const phone = selectOnboardedPhone({
      reported: phoneNumberId,
      candidates,
      coexistenceHint: Boolean(coexistence),
    });

    const isCoexistence = isCoexistenceNumber({ coexistenceHint: Boolean(coexistence), platformType: phone.platformType });
    logOnboardingResolution({
      wabaId: resolvedWabaId,
      phoneNumberId: phone.id,
      coexistence: isCoexistence,
      candidateCount: candidates.length,
    });

    // ── 4. Subscribe this app to the customer's WABA + persist ─────────────────
    const webhookSubscribed = await subscribeAppToWaba({ wabaId: resolvedWabaId, accessToken });

    // Prefer the token's own expiry (debug_token) over the code-exchange
    // response: a business-integration token is typically non-expiring, and
    // debug_token is authoritative about that.
    const tokenExpiresAt =
      validation.expiresAt !== null
        ? new Date(validation.expiresAt)
        : codeExchangeExpiresIn
          ? new Date(Date.now() + codeExchangeExpiresIn * 1000)
          : null;

    const account: any = await upsertAndActivateAccountForUser({
      userId: authed.id,
      phoneNumberId: String(phone.id),
      setPayload: {
        connectionMode: isCoexistence ? 'coexistence' : 'embedded_signup',
        wabaId: String(resolvedWabaId),
        businessAccountId: String(businessId || ''),
        displayPhoneNumber: String(phone.displayPhoneNumber || phone.id),
        verifiedName: String(phone.verifiedName || ''),
        accessTokenEncrypted: encryptSensitiveValue(String(accessToken)),
        tokenType: 'Bearer',
        tokenExpiresAt,
        status: 'active',
        webhookSubscribed,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        'coexistence.enabled': isCoexistence,
        'coexistence.platformType': String(phone.platformType || ''),
        // Meta starts streaming `history` shortly after a coexistence number is
        // onboarded — mark it pending so the UI shows "importing chats" rather
        // than an empty inbox.
        ...(isCoexistence ? { 'coexistence.historySyncStatus': 'in_progress' } : {}),
      },
    });

    if (!webhookSubscribed) {
      // Not fatal to the connection — the number is claimed and can send — but
      // it will receive nothing until the app is attached to the WABA, so this
      // is surfaced rather than swallowed.
      logger.warn(
        `[embedded-signup] Account ${account._id} connected but the app is NOT subscribed to WABA ${resolvedWabaId} — inbound webhooks will not arrive until this succeeds`
      );
    }

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'whatsapp_account.connect',
      resource: 'whatsapp_account',
      resourceId: account._id,
      metadata: { connectionMode: isCoexistence ? 'coexistence' : 'embedded_signup', phoneNumberId: phone.id },
    });

    return NextResponse.json({ success: true, data: sanitizeAccount(account) });
  } catch (error) {
    return errorResponse(error, 'Failed to complete embedded signup');
  }
}
