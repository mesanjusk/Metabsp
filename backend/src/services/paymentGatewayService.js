/**
 * UPI Autopay billing via Cashfree's Subscriptions API.
 *
 * ============================================================================
 * VERIFY BEFORE PRODUCTION: this module's request/response field names
 * (subscriptionId, authPaymentInfo.vpa/authFlow, webhook signature header
 * name, event type strings) are based on Cashfree's publicly documented
 * Subscriptions/UPI Autopay API shape, but this repository's sandbox could
 * not reach cashfree.com's docs to fetch the live, current reference (both
 * https://www.cashfree.com/docs/... and the Postman-hosted docs returned
 * HTTP 403 to automated fetches). Confirm every field name and the webhook
 * signature algorithm against Cashfree's current API reference and a
 * sandbox test call before processing real payments with this code.
 * ============================================================================
 */
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

const isProduction = () => String(process.env.CASHFREE_ENV || 'sandbox').toLowerCase() === 'production';
const BASE_URL = () => (isProduction() ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com');

function authHeaders() {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET are not configured');
  }
  return {
    'x-client-id': clientId,
    'x-client-secret': clientSecret,
    'x-api-version': process.env.CASHFREE_API_VERSION || '2023-08-01',
    'Content-Type': 'application/json',
  };
}

// Creates a UPI Autopay mandate request. Returns an authorization link the
// customer must open (in the frontend, e.g. a redirect or QR code) to
// approve the recurring mandate in their UPI app — the subscription is not
// active until that happens (see the webhook handler below).
async function createUpiAutopaySubscription({
  gatewaySubscriptionId,
  planName,
  authAmountInPaise,
  recurringAmountInPaise,
  customerName,
  customerEmail,
  customerPhone,
  returnUrl,
}) {
  const payload = {
    subscriptionId: gatewaySubscriptionId,
    planInfo: {
      type: 'ON_DEMAND',
      planName,
      maxAmount: recurringAmountInPaise / 100,
      maxCycles: 9999,
      intervalType: 'MONTH',
      intervals: 1,
    },
    customerDetails: {
      customerName,
      customerEmail,
      customerPhone,
    },
    authAmount: authAmountInPaise / 100,
    authPaymentInfo: {
      paymentType: 'UPI',
      authFlow: 'UPI_INTENT',
    },
    returnUrl,
  };

  const { data } = await axios.post(`${BASE_URL()}/pg/subscriptions`, payload, {
    headers: authHeaders(),
    timeout: 15000,
  });

  return {
    gatewaySubscriptionId,
    authorizationLink: data?.authLink || data?.data?.authLink || '',
    raw: data,
  };
}

// Cashfree webhooks are signed with an HMAC-SHA256 over `timestamp + rawBody`
// using the client secret, base64-encoded, sent in an `x-webhook-signature`
// header alongside `x-webhook-timestamp` — confirm this against live docs
// (see module header) before trusting it in production.
function verifyWebhookSignature({ rawBody, signature, timestamp }) {
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientSecret || !signature || !timestamp) return false;

  const expected = crypto
    .createHmac('sha256', clientSecret)
    .update(timestamp + rawBody)
    .digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Normalizes a webhook payload into a small set of event types this app
// actually acts on, so the route handler doesn't need to know Cashfree's
// exact event-type strings.
function classifyWebhookEvent(payload) {
  const type = String(payload?.type || '').toUpperCase();

  if (type.includes('SUBSCRIPTION') && (type.includes('ACTIVATED') || type.includes('AUTHORIZED'))) {
    return { kind: 'mandate_activated', gatewaySubscriptionId: payload?.data?.subscription?.subscriptionId };
  }
  if (type.includes('PAYMENT') && type.includes('SUCCESS')) {
    return {
      kind: 'payment_success',
      gatewaySubscriptionId: payload?.data?.subscription?.subscriptionId,
      gatewayPaymentId: payload?.data?.payment?.cfPaymentId || payload?.data?.payment?.paymentId,
      amountInPaise: Math.round(Number(payload?.data?.payment?.paymentAmount || 0) * 100),
    };
  }
  if (type.includes('PAYMENT') && (type.includes('FAILED') || type.includes('USER_DROPPED'))) {
    return {
      kind: 'payment_failed',
      gatewaySubscriptionId: payload?.data?.subscription?.subscriptionId,
      gatewayPaymentId: payload?.data?.payment?.cfPaymentId || payload?.data?.payment?.paymentId,
    };
  }
  logger.info('[payment-gateway] Unrecognized webhook event type:', type);
  return { kind: 'unknown' };
}

module.exports = { createUpiAutopaySubscription, verifyWebhookSignature, classifyWebhookEvent };
