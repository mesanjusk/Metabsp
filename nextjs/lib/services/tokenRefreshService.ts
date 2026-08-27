import axios from 'axios';
import WhatsAppAccount from '../models/WhatsAppAccount';
import { encryptSensitiveValue, decryptSensitiveValue } from '../utils/crypto';
import { getGraphApiVersion } from '../config/graphApi';
import { withLeaderLock } from './schedulerLock';
import logger from '../utils/logger';

// Ported from backend/src/services/tokenRefreshService.js.
//
// This is the single most consequential background job in the product, and the
// failure mode is silent. Meta long-lived user access tokens last ~60 days and
// have no OAuth refresh_token; the documented way to extend one is to
// re-exchange the still-valid token through the same fb_exchange_token grant
// used at connect time. If nothing does that on a schedule, every connected
// number keeps working right up until it doesn't, and the first symptom is a
// customer's messages failing.
//
// A token that is already invalid (the exchange fails) marks the account
// 'error' so the customer is prompted to reconnect, rather than leaving a dead
// token in place that fails every send.

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // refresh within 7 days of expiry

export async function refreshExpiringTokens() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { checked: 0, refreshed: 0, failed: 0 };

  const cutoff = new Date(Date.now() + REFRESH_WINDOW_MS);
  const accounts = await WhatsAppAccount.find({
    isActive: true,
    status: 'active',
    tokenExpiresAt: { $ne: null, $lte: cutoff },
    // System User tokens are managed by hand in Meta Business Manager and are
    // typically set never to expire. Re-exchanging one through
    // fb_exchange_token is not the documented path for them, so they are
    // excluded rather than risk invalidating a working token.
    tokenSource: { $ne: 'system_user' },
  });

  let refreshed = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      const currentToken = decryptSensitiveValue(account.accessTokenEncrypted);
      const graphVersion = getGraphApiVersion();
      const { data } = await axios.get(`https://graph.facebook.com/${graphVersion}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: currentToken,
        },
        timeout: 15000,
      });

      if (!data?.access_token) throw new Error('Meta did not return a refreshed access token');

      account.accessTokenEncrypted = encryptSensitiveValue(data.access_token);
      account.tokenExpiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000) : null;
      await account.save();
      refreshed += 1;
      logger.info(`[token-refresh] Refreshed token for WhatsApp account ${account._id}`);
    } catch (error: any) {
      failed += 1;
      account.status = 'error';
      await account.save().catch(() => {});
      logger.warn(
        `[token-refresh] Failed to refresh token for WhatsApp account ${account._id}, marked as error: ${
          JSON.stringify(error?.response?.data) || error.message
        }`
      );
    }
  }

  return { checked: accounts.length, refreshed, failed };
}

// .unref() so this poller never keeps the process alive by itself.
export function startTokenRefreshScheduler({ intervalMs = 24 * 60 * 60 * 1000 } = {}) {
  return setInterval(() => {
    withLeaderLock('token-refresh', refreshExpiringTokens).catch((error: any) =>
      logger.error(`[token-refresh] Scheduled refresh run failed: ${error.message}`)
    );
  }, intervalMs).unref();
}
