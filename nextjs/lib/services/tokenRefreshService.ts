import axios from 'axios';
import WhatsAppAccount from '../models/WhatsAppAccount';
import { connectDB } from '../db/mongo';
import { encryptSensitiveValue, decryptSensitiveValue } from '../utils/crypto';
import { getGraphApiVersion } from '../config/graphApi';
import { withLeaderLock } from './schedulerLock';
import logger from '../utils/logger';

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // refresh once within 7 days of expiry

/**
 * Meta long-lived user access tokens (~60 days) have no OAuth refresh_token —
 * the documented way to extend one is to re-exchange the still-valid token
 * for a new long-lived token via the same fb_exchange_token grant used at
 * connect time. This finds accounts expiring soon and does that; a token
 * that is already invalid (exchange fails) gets marked 'error' so the
 * customer is prompted to reconnect rather than sends silently failing.
 *
 * This is the single most important background job in the product: without
 * it, every connected customer number stops sending roughly 60 days after
 * onboarding, with no signal until a message fails.
 */
export async function refreshExpiringTokens() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    logger.warn('[token-refresh] META_APP_ID/META_APP_SECRET not set — skipping refresh cycle');
    return { checked: 0, refreshed: 0, failed: 0 };
  }

  await connectDB();

  const cutoff = new Date(Date.now() + REFRESH_WINDOW_MS);
  const accounts: any[] = await WhatsAppAccount.find({
    isActive: true,
    status: 'active',
    tokenExpiresAt: { $ne: null, $lte: cutoff },
    // System User tokens are managed manually in Meta Business Manager
    // (typically set to never expire) — re-exchanging one via
    // fb_exchange_token is not the documented refresh path for them, so they
    // are excluded here rather than risk invalidating a working token.
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
        `[token-refresh] Failed to refresh token for WhatsApp account ${account._id}, marked as error:`,
        error?.response?.data || error.message
      );
    }
  }

  return { checked: accounts.length, refreshed, failed };
}

// .unref() so this poller never keeps the process alive by itself.
// withLeaderLock ensures only one replica runs it on any given tick.
export function startTokenRefreshScheduler({ intervalMs = 24 * 60 * 60 * 1000 } = {}) {
  return setInterval(() => {
    withLeaderLock('token-refresh', refreshExpiringTokens).catch((error) =>
      logger.error('[token-refresh] Scheduled refresh run failed:', error.message)
    );
  }, intervalMs).unref();
}
