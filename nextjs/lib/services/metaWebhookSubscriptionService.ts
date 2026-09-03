import axios from 'axios';
import AppError from '../utils/AppError';
import { getGraphApiVersion, getWebhookVerifyToken } from '../config/graphApi';
import { BASE_WEBHOOK_FIELDS, ALL_WEBHOOK_FIELDS, describeGraphFailure } from './preflightCheckService';
import logger from '../utils/logger';

const GRAPH_TIMEOUT_MS = 10000;

/**
 * Where Meta is delivering, versus where this deployment is listening.
 *
 * This deployment ran for weeks with `messages` subscribed, the subscription
 * active, the verify handshake passing, and every inbound message being POSTed
 * to a different Render service that had since been suspended. Nothing in the
 * App Dashboard reads as wrong in that state — the Configuration page shows
 * the URL you last typed there, while the callback Meta actually holds for the
 * `whatsapp_business_account` object subscription is a separate stored value
 * that an edit can quietly fail to update.
 *
 * So this compares the two by origin rather than by string: a trailing slash
 * or a different path on the same host is a deployment detail, but a different
 * host means the messages are going somewhere else entirely.
 */
export const compareCallbackUrls = ({ current, expected }: { current?: string; expected?: string }) => {
  const currentUrl = String(current || '').trim();
  const expectedUrl = String(expected || '').trim();

  if (!expectedUrl) return { state: 'unknown', reason: 'This deployment could not determine its own public URL' };
  if (!currentUrl) return { state: 'unset', reason: 'Meta has no callback URL stored for this app' };

  let currentOrigin = '';
  let expectedOrigin = '';
  try {
    currentOrigin = new URL(currentUrl).origin.toLowerCase();
    expectedOrigin = new URL(expectedUrl).origin.toLowerCase();
  } catch (_error) {
    return { state: 'unknown', reason: `Could not parse one of the URLs (${currentUrl} / ${expectedUrl})` };
  }

  if (currentOrigin !== expectedOrigin) {
    return {
      state: 'elsewhere',
      reason:
        `Meta delivers to ${currentUrl}, which is not this deployment (${expectedOrigin}). ` +
        'Inbound messages are being POSTed there, not here — and nothing about that state looks wrong from ' +
        'the App Dashboard.',
    };
  }

  if (currentUrl.replace(/\/+$/, '') !== expectedUrl.replace(/\/+$/, '')) {
    return { state: 'same_host', reason: `Meta delivers to ${currentUrl}; this deployment expects ${expectedUrl}` };
  }

  return { state: 'match', reason: `Meta delivers to ${currentUrl}` };
};

/**
 * POST /{app-id}/subscriptions — point the app's `whatsapp_business_account`
 * subscription at this deployment.
 *
 * The callback URL is never taken from the caller. It is derived server-side
 * from the request's own host, because an endpoint that accepts a URL and
 * hands it to Meta is an endpoint for redirecting somebody else's WhatsApp
 * traffic to a server of your choosing.
 *
 * Meta verifies synchronously: it GETs the callback URL with hub.challenge
 * before storing anything, so a wrong verify token or an unreachable
 * deployment fails here rather than silently later.
 */
export const subscribeAppWebhook = async ({
  callbackUrl,
  appId = process.env.META_APP_ID,
  appSecret = process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET,
  verifyToken = getWebhookVerifyToken(),
  graphVersion = getGraphApiVersion(),
  coexistenceEnabled = String(process.env.META_ENABLE_COEXISTENCE || '').toLowerCase() === 'true',
}: any) => {
  if (!appId || !appSecret) {
    throw new AppError('META_APP_ID and META_APP_SECRET must both be set to update the webhook subscription', 400);
  }
  if (!verifyToken) {
    throw new AppError(
      'No webhook verify token is configured. Meta verifies the callback URL before storing it, and that ' +
        'handshake cannot pass without one.',
      400
    );
  }
  if (!callbackUrl || !/^https:\/\//i.test(callbackUrl)) {
    throw new AppError('The callback URL must be https — Meta refuses anything else', 400);
  }

  const fields = coexistenceEnabled ? ALL_WEBHOOK_FIELDS : BASE_WEBHOOK_FIELDS;

  try {
    const res = await axios.post(
      `https://graph.facebook.com/${graphVersion}/${appId}/subscriptions`,
      null,
      {
        params: {
          object: 'whatsapp_business_account',
          callback_url: callbackUrl,
          verify_token: verifyToken,
          fields: fields.join(','),
          access_token: `${appId}|${appSecret}`,
        },
        timeout: GRAPH_TIMEOUT_MS,
      }
    );

    if (res.data?.success === false) {
      throw new AppError('Meta rejected the webhook subscription without saying why', 502);
    }

    logger.info(`[whatsapp][webhook] App subscription repointed to ${callbackUrl} for: ${fields.join(', ')}`);
    return { callbackUrl, fields };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    const reason = describeGraphFailure(error);
    logger.error(`[whatsapp][webhook] Could not repoint the app subscription to ${callbackUrl}: ${reason}`);
    throw new AppError(`Meta refused the webhook subscription: ${reason}`, 502);
  }
};
