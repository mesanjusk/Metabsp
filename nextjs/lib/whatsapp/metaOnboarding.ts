// Server-side validation and asset discovery for Meta Embedded Signup v4.
//
// The browser is never trusted as the sole authority for the WABA id, the
// phone number id, the business id, or the coexistence flag (see
// docs/meta-tech-provider/COEXISTENCE.md § Embedded Signup v4). Everything the
// popup posts back is a *hint*; this module re-derives and validates each fact
// against Meta before the account row is written.
//
// The selection logic (which WABA, which phone number) is deliberately split
// into pure functions so it can be unit-tested without the network — the risky
// part of Phase 5 is the ambiguity handling, not the HTTP call.

import axios from 'axios';
import AppError from '../utils/AppError';
import { getGraphApiVersion } from '../config/graphApi';
import logger from '../utils/logger';

const GRAPH = 'https://graph.facebook.com';
const GRAPH_TIMEOUT_MS = 15000;

// The permissions this integration is approved for and needs to manage a
// customer's WABA + send/receive. A token that lacks either cannot do the job,
// so it is rejected at connect time rather than failing later on a send.
export const REQUIRED_WHATSAPP_SCOPES = ['whatsapp_business_management', 'whatsapp_business_messaging'];

const isNumericId = (value: unknown) => /^\d+$/.test(String(value ?? ''));

export type TokenValidation = {
  scopes: string[];
  // WABA ids the token actually grants access to, read from debug_token's
  // granular_scopes. Empty is possible on older Meta behaviour even when access
  // was granted, so it is treated as "cannot cross-check", not "no access".
  wabaTargetIds: string[];
  // Unix ms, or null when the token never expires (Meta reports expires_at: 0).
  expiresAt: number | null;
};

export type PhoneCandidate = {
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
  platformType: string;
};

const normalizeGraphError = (error: any, fallback: string) => {
  const apiMessage = error?.response?.data?.error?.message;
  const status = error?.response?.status;
  return new AppError(apiMessage || fallback, status && status < 500 ? 400 : 502);
};

// ── debug_token ───────────────────────────────────────────────────────────────

/**
 * GET /debug_token — Meta's own reading of the token we just minted.
 *
 * Called with an app access token (`{app-id}|{app-secret}`), so it needs no
 * customer credentials and cannot be spoofed by the browser. Returns the raw
 * `data` object; validation is a separate pure function so it is testable.
 */
export const debugToken = async ({
  token,
  appId = process.env.META_APP_ID,
  appSecret = process.env.META_APP_SECRET,
  graphVersion = getGraphApiVersion(),
}: {
  token: string;
  appId?: string;
  appSecret?: string;
  graphVersion?: string;
}): Promise<any> => {
  if (!appId || !appSecret) throw new AppError('Meta app credentials are not configured on the server', 500);
  try {
    const res = await axios.get(`${GRAPH}/${graphVersion}/debug_token`, {
      params: { input_token: token, access_token: `${appId}|${appSecret}` },
      timeout: GRAPH_TIMEOUT_MS,
    });
    return res.data?.data || {};
  } catch (error) {
    throw normalizeGraphError(error, 'Meta rejected the access-token validation request');
  }
};

/** WABA ids from debug_token granular_scopes for the WhatsApp scopes only. */
export const extractWabaTargetIds = (debugData: any): string[] => {
  const granular = Array.isArray(debugData?.granular_scopes) ? debugData.granular_scopes : [];
  const ids = new Set<string>();
  for (const entry of granular) {
    const scope = String(entry?.scope || '');
    if (!REQUIRED_WHATSAPP_SCOPES.includes(scope)) continue;
    for (const target of Array.isArray(entry?.target_ids) ? entry.target_ids : []) {
      if (isNumericId(target)) ids.add(String(target));
    }
  }
  return [...ids];
};

/**
 * Pure validation of a debug_token payload.
 *
 * Rejects a token that is invalid, belongs to another Meta app, or is missing
 * a required WhatsApp scope — the three ways an attacker-supplied or
 * misconfigured token would otherwise be persisted and used to send on the
 * platform's behalf.
 */
export const validateTokenDebugData = (
  debugData: any,
  { expectedAppId = process.env.META_APP_ID }: { expectedAppId?: string } = {}
): TokenValidation => {
  const data = debugData || {};

  if (data.is_valid === false) {
    throw new AppError('Meta reports this access token is not valid', 400);
  }

  const tokenAppId = String(data.app_id || '');
  if (!expectedAppId) throw new AppError('META_APP_ID is not configured on the server', 500);
  if (!tokenAppId || tokenAppId !== String(expectedAppId)) {
    // Deliberately does not echo the offending app id — the useful action is
    // "reconnect", not "here is which foreign app you or an attacker used".
    throw new AppError('This access token belongs to a different Meta app and was rejected', 400);
  }

  const scopes = (Array.isArray(data.scopes) ? data.scopes : []).map((s: any) => String(s));
  const missing = REQUIRED_WHATSAPP_SCOPES.filter((s) => !scopes.includes(s));
  if (missing.length) {
    throw new AppError(`This connection is missing required WhatsApp permission(s): ${missing.join(', ')}`, 400);
  }

  // expires_at is unix seconds; 0 (or absent) means a non-expiring token.
  const expiresAtSeconds = Number(data.expires_at);
  const expiresAt = Number.isFinite(expiresAtSeconds) && expiresAtSeconds > 0 ? expiresAtSeconds * 1000 : null;

  return { scopes, wabaTargetIds: extractWabaTargetIds(data), expiresAt };
};

// ── WABA id resolution ──────────────────────────────────────────────────────

/**
 * Decide which WABA this connection is for. Pure.
 *
 * The browser's reported id is only trusted when the token's granular scopes
 * either confirm it or cannot speak to it at all. If the token clearly grants
 * a different set of WABAs than the browser claimed, that is a mismatch worth
 * refusing rather than papering over.
 */
export const resolveWabaId = ({
  reported,
  wabaTargetIds,
}: {
  reported?: string;
  wabaTargetIds: string[];
}): string => {
  const rep = String(reported || '').trim();
  const ids = (wabaTargetIds || []).filter(isNumericId);

  if (rep && isNumericId(rep)) {
    if (ids.length && !ids.includes(rep)) {
      throw new AppError(
        'The WhatsApp Business Account reported by the browser is not covered by the granted access token',
        400
      );
    }
    return rep;
  }

  if (ids.length === 1) return ids[0];
  if (ids.length > 1) {
    throw new AppError(
      'The access token grants several WhatsApp Business Accounts and the browser named none — reconnect and choose one',
      409
    );
  }
  throw new AppError('Could not determine the WhatsApp Business Account for this connection', 400);
};

// ── Phone number discovery ──────────────────────────────────────────────────

/** GET /{waba-id}/phone_numbers — the numbers on the customer's WABA. */
export const fetchWabaPhoneNumbers = async ({
  wabaId,
  accessToken,
  graphVersion = getGraphApiVersion(),
}: {
  wabaId: string;
  accessToken: string;
  graphVersion?: string;
}): Promise<PhoneCandidate[]> => {
  try {
    const res = await axios.get(`${GRAPH}/${graphVersion}/${wabaId}/phone_numbers`, {
      params: { fields: 'id,display_phone_number,verified_name,platform_type' },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: GRAPH_TIMEOUT_MS,
    });
    const rows = Array.isArray(res.data?.data) ? res.data.data : [];
    return rows
      .map((p: any) => ({
        id: String(p?.id || ''),
        displayPhoneNumber: String(p?.display_phone_number || ''),
        verifiedName: String(p?.verified_name || ''),
        platformType: String(p?.platform_type || ''),
      }))
      .filter((p: PhoneCandidate) => p.id);
  } catch (error) {
    throw normalizeGraphError(error, 'Could not read the phone numbers on this WhatsApp Business Account');
  }
};

/**
 * Choose the onboarded phone number from the WABA's numbers. Pure.
 *
 * Rules, in order (Phase 5):
 *  1. A browser-reported id is honoured only if it is genuinely on the WABA;
 *     a reported id that is absent is a mismatch, not a fallback to guessing.
 *  2. Exactly one number → use it.
 *  3. No numbers → precise error (the WABA has nothing to onboard).
 *  4. Several numbers, none reported → narrow to a single SMB_APP (coexistence)
 *     candidate when coexistence is expected; otherwise refuse rather than pick
 *     a number at random.
 */
export const selectOnboardedPhone = ({
  reported,
  candidates,
  coexistenceHint = false,
}: {
  reported?: string;
  candidates: PhoneCandidate[];
  coexistenceHint?: boolean;
}): PhoneCandidate => {
  const rep = String(reported || '').trim();
  const list = Array.isArray(candidates) ? candidates : [];

  if (rep) {
    const match = list.find((c) => c.id === rep);
    if (match) return match;
    throw new AppError(
      'The phone number reported by the browser is not part of the connected WhatsApp Business Account',
      400
    );
  }

  if (list.length === 1) return list[0];
  if (list.length === 0) {
    throw new AppError('The connected WhatsApp Business Account has no phone numbers to onboard', 400);
  }

  const smbApp = list.filter((c) => c.platformType.toUpperCase() === 'SMB_APP');
  if (coexistenceHint && smbApp.length === 1) return smbApp[0];

  const label = list.map((c) => c.displayPhoneNumber || c.id).join(', ');
  throw new AppError(
    `Several phone numbers are available on this WhatsApp Business Account (${label}). ` +
      'Reconnect and choose the specific number to link.',
    409
  );
};

/** Whether the resolved number should be stored as coexistence. */
export const isCoexistenceNumber = ({
  coexistenceHint = false,
  platformType = '',
}: {
  coexistenceHint?: boolean;
  platformType?: string;
}): boolean => Boolean(coexistenceHint) || String(platformType).toUpperCase() === 'SMB_APP';

/** Trace helper — logs only non-sensitive ids, never tokens/codes/secrets. */
export const logOnboardingResolution = ({
  wabaId,
  phoneNumberId,
  coexistence,
  candidateCount,
}: {
  wabaId: string;
  phoneNumberId: string;
  coexistence: boolean;
  candidateCount: number;
}) => {
  logger.info(
    `[embedded-signup] resolved waba=${wabaId} phone_number_id=${phoneNumberId} ` +
      `coexistence=${coexistence} candidates=${candidateCount}`
  );
};
