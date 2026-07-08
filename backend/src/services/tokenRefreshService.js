const axios = require('axios');
const WhatsAppAccount = require('../repositories/whatsappAccount');
const { encryptSensitiveValue, decryptSensitiveValue } = require('../utils/crypto');
const { getGraphApiVersion } = require('../config/graphApi');
const logger = require('../utils/logger');

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // refresh once within 7 days of expiry

// Meta long-lived user access tokens (~60 days) have no OAuth refresh_token —
// the documented way to extend one is to re-exchange the still-valid token
// for a new long-lived token via the same fb_exchange_token grant used at
// connect time. This finds accounts expiring soon and does that; a token
// that's already invalid (exchange fails) gets marked 'error' so the
// customer is prompted to reconnect rather than silently failing sends.
async function refreshExpiringTokens() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { checked: 0, refreshed: 0, failed: 0 };

  const cutoff = new Date(Date.now() + REFRESH_WINDOW_MS);
  const accounts = await WhatsAppAccount.find({
    isActive: true,
    status: 'active',
    tokenExpiresAt: { $ne: null, $lte: cutoff },
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
    } catch (error) {
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

// .unref() so this background poller never keeps the process alive by
// itself (matches the fix applied to the campaign scheduler in Phase 0).
function startTokenRefreshScheduler({ intervalMs = 24 * 60 * 60 * 1000 } = {}) {
  return setInterval(() => {
    refreshExpiringTokens().catch((error) =>
      logger.error('[token-refresh] Scheduled refresh run failed:', error.message)
    );
  }, intervalMs).unref();
}

module.exports = { refreshExpiringTokens, startTokenRefreshScheduler };
