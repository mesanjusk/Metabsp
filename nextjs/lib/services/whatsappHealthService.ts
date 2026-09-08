import axios from 'axios';
import logger from '../utils/logger';
import { getGraphApiVersion as getGraphVersion } from '../config/graphApi';

// Ported from backend/src/services/whatsappHealthService.js.
const TOKEN_ERROR_CODES = new Set([190, 10, 102, 200, 2500]);
const DEFINITIVE_OBJECT_ACCESS_PATTERNS = [
  /unsupported get request/i,
  /does not exist/i,
  /cannot be loaded/i,
  /missing permissions/i,
  /permission/i,
];

export const classifyWhatsAppApiError = (error: any) => {
  if (!error) return { code: 'NETWORK_ERROR', message: 'Unknown error' };

  if (error.response) {
    const status = Number(error.response.status || 0);
    const apiError = error.response.data?.error || {};
    const apiCode = Number(apiError.code || 0);
    const graphMessage = String(apiError.error_user_msg || apiError.message || '').trim() || undefined;

    if (status === 401 || status === 403 || TOKEN_ERROR_CODES.has(apiCode)) {
      return {
        code: 'TOKEN_EXPIRED',
        message: 'WhatsApp token is invalid, expired, or no longer authorized',
        status,
        apiCode,
        graphMessage,
      };
    }

    // When a customer removes the WhatsApp asset / business integration on
    // Meta's side, the phone-number lookup commonly changes from a successful
    // GET to Graph error 100 ("Unsupported get request", "cannot be loaded",
    // or equivalent permission text). That is different from a timeout or a
    // 5xx: access to this exact phone-number object has been revoked and the
    // workspace should stop presenting the account as connected.
    if (
      apiCode === 100 &&
      graphMessage &&
      DEFINITIVE_OBJECT_ACCESS_PATTERNS.some((pattern) => pattern.test(graphMessage))
    ) {
      return {
        code: 'ACCESS_REVOKED',
        message: 'WhatsApp phone-number access was revoked in Meta',
        status,
        apiCode,
        graphMessage,
      };
    }

    // Meta's own user-facing strings are safe to surface (they carry no token
    // or config secrets) and tell the sender what to fix — e.g. a template
    // name that doesn't exist, or a recipient who hasn't opted in.
    return { code: 'NETWORK_ERROR', message: 'WhatsApp API request failed', status, apiCode, graphMessage };
  }

  return { code: 'NETWORK_ERROR', message: 'Unable to reach WhatsApp API' };
};

export const isDefinitiveWhatsAppDisconnectReason = (reason: unknown) =>
  reason === 'TOKEN_EXPIRED' || reason === 'ACCESS_REVOKED';

export const validateWhatsAppConfig = (overrides: any = {}) => {
  const accessToken = String(overrides.accessToken || '').trim();
  const phoneNumberId = String(overrides.phoneNumberId || '').trim();

  if (!accessToken || !phoneNumberId) {
    return {
      ok: false as const,
      error: { code: 'INVALID_CONFIG', message: 'Missing WhatsApp access token or phone number id' },
    };
  }

  return {
    ok: true as const,
    accessToken,
    phoneNumberId,
    graphVersion: String(overrides.graphVersion || getGraphVersion()),
  };
};

export const checkWhatsAppHealth = async (overrides: any = {}) => {
  const config = validateWhatsAppConfig(overrides);
  if (!config.ok) return { isConnected: false, reason: config.error.code };

  const { accessToken, phoneNumberId, graphVersion } = config;

  try {
    const response = await axios.get(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { fields: 'id,display_phone_number,verified_name,quality_rating,status' },
      timeout: 10000,
    });

    if (!response?.data?.id) return { isConnected: false, reason: 'NETWORK_ERROR' };
    return { isConnected: true, reason: null, details: response.data };
  } catch (error: any) {
    const normalized = classifyWhatsAppApiError(error);
    logger.error('[whatsapp] health-check failed:', normalized.code, error?.response?.status || error?.message);
    return { isConnected: false, reason: normalized.code };
  }
};
