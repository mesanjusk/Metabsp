import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger';

/**
 * UPI Autopay billing via Cashfree's Subscriptions API.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOT VERIFIED AGAINST LIVE CASHFREE DOCUMENTATION.
 *
 * The request/response field names below (subscriptionId, authPaymentInfo,
 * the webhook signature header and algorithm, the event-type strings) were
 * written from Cashfree's publicly documented Subscriptions/UPI Autopay
 * shape, but could not be checked against the live reference — cashfree.com's
 * docs return HTTP 403 to automated fetches from this repository's
 * environment. Every field and the signature algorithm must be confirmed
 * against Cashfree's current API reference and one sandbox call before this
 * handles real money.
 *
 * That is why `isBillingConfigured()` exists and why the routes refuse rather
 * than half-work when it returns false. Billing stays OFF until an operator
 * sets the credentials, which is a deliberate choice: an unverified payment
 * integration that silently appears to work is worse than one that plainly
 * says it is not enabled.
 * ══════════════════════════════════════════════════════════════════════════
 */
const isProduction = () => String(process.env.CASHFREE_ENV || 'sandbox').toLowerCase() === 'production';
const baseUrl = () => (isProduction() ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com');

export function isBillingConfigured(): boolean {
  return Boolean(process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET);
}

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

/**
 * Creates a UPI Autopay mandate request. Returns an authorization link the
 * customer must open to approve the recurring mandate in their UPI app — the
 * subscription is not active until the webhook says so.
 */
export async function createUpiAutopaySubscription({
  gatewaySubscriptionId,
  planName,
  authAmountInPaise,
  recurringAmountInPaise,
  customerName,
  customerEmail,
  customerPhone,
  returnUrl,
}: {
  gatewaySubscriptionId: string;
  planName: string;
  authAmountInPaise: number;
  recurringAmountInPaise: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl: string;
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
    customerDetails: { customerName, customerEmail, customerPhone },
    authAmount: authAmountInPaise / 100,
    authPaymentInfo: { paymentType: 'UPI', authFlow: 'UPI_INTENT' },
    returnUrl,
  };

  const { data } = await axios.post(`${baseUrl()}/pg/subscriptions`, payload, {
    headers: authHeaders(),
    timeout: 15000,
  });

  return {
    gatewaySubscriptionId,
    authorizationLink: data?.authLink || data?.data?.authLink || '',
    raw: data,
  };
}

/**
 * Cashfree webhooks are signed with an HMAC-SHA256 over `timestamp + rawBody`
 * using the client secret, base64-encoded, in an `x-webhook-signature` header
 * alongside `x-webhook-timestamp`. See the module header before trusting this.
 */
export function verifyWebhookSignature({
  rawBody,
  signature,
  timestamp,
}: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
}): boolean {
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientSecret || !signature || !timestamp) return false;

  const expected = crypto.createHmac('sha256', clientSecret).update(timestamp + rawBody).digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Normalizes a webhook payload into the small set of events this app acts on,
 * so route handlers do not need to know Cashfree's exact event-type strings.
 */
export function classifyWebhookEvent(payload: any) {
  const type = String(payload?.type || '').toUpperCase();

  if (type.includes('SUBSCRIPTION') && (type.includes('ACTIVATED') || type.includes('AUTHORIZED'))) {
    return { kind: 'mandate_activated' as const, gatewaySubscriptionId: payload?.data?.subscription?.subscriptionId };
  }
  if (type.includes('PAYMENT') && type.includes('SUCCESS')) {
    return {
      kind: 'payment_success' as const,
      gatewaySubscriptionId: payload?.data?.subscription?.subscriptionId,
      gatewayPaymentId: payload?.data?.payment?.cfPaymentId || payload?.data?.payment?.paymentId,
      amountInPaise: Math.round(Number(payload?.data?.payment?.paymentAmount || 0) * 100),
    };
  }
  if (type.includes('PAYMENT') && (type.includes('FAILED') || type.includes('USER_DROPPED'))) {
    return {
      kind: 'payment_failed' as const,
      gatewaySubscriptionId: payload?.data?.subscription?.subscriptionId,
      gatewayPaymentId: payload?.data?.payment?.cfPaymentId || payload?.data?.payment?.paymentId,
    };
  }

  logger.info('[payment-gateway] Unrecognized webhook event type:', type);
  return { kind: 'unknown' as const, gatewaySubscriptionId: undefined, gatewayPaymentId: undefined };
}
