const crypto = require('crypto');
const { verifyWebhookSignature, classifyWebhookEvent } = require('../src/services/paymentGatewayService');

describe('paymentGatewayService.verifyWebhookSignature', () => {
  const originalSecret = process.env.CASHFREE_CLIENT_SECRET;

  beforeAll(() => {
    process.env.CASHFREE_CLIENT_SECRET = 'test-client-secret';
  });

  afterAll(() => {
    process.env.CASHFREE_CLIENT_SECRET = originalSecret;
  });

  const sign = (timestamp, rawBody) =>
    crypto.createHmac('sha256', 'test-client-secret').update(timestamp + rawBody).digest('base64');

  it('accepts a correctly signed payload', () => {
    const timestamp = '1700000000';
    const rawBody = '{"type":"PAYMENT_SUCCESS"}';
    const signature = sign(timestamp, rawBody);

    expect(verifyWebhookSignature({ rawBody, signature, timestamp })).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const timestamp = '1700000000';
    const signature = sign(timestamp, '{"type":"PAYMENT_SUCCESS"}');

    expect(verifyWebhookSignature({ rawBody: '{"type":"PAYMENT_SUCCESS","amount":999999}', signature, timestamp })).toBe(false);
  });

  it('rejects when the signature is missing', () => {
    expect(verifyWebhookSignature({ rawBody: '{}', signature: '', timestamp: '123' })).toBe(false);
  });

  it('rejects when the client secret is not configured', () => {
    delete process.env.CASHFREE_CLIENT_SECRET;
    expect(verifyWebhookSignature({ rawBody: '{}', signature: 'anything', timestamp: '123' })).toBe(false);
    process.env.CASHFREE_CLIENT_SECRET = 'test-client-secret';
  });
});

describe('paymentGatewayService.classifyWebhookEvent', () => {
  it('classifies a mandate-activated event', () => {
    const result = classifyWebhookEvent({
      type: 'SUBSCRIPTION_ACTIVATED',
      data: { subscription: { subscriptionId: 'sub_123' } },
    });
    expect(result).toEqual({ kind: 'mandate_activated', gatewaySubscriptionId: 'sub_123' });
  });

  it('classifies a successful payment event and converts rupees to paise', () => {
    const result = classifyWebhookEvent({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: { subscription: { subscriptionId: 'sub_123' }, payment: { cfPaymentId: 'pay_1', paymentAmount: 999.0 } },
    });
    expect(result).toEqual({
      kind: 'payment_success',
      gatewaySubscriptionId: 'sub_123',
      gatewayPaymentId: 'pay_1',
      amountInPaise: 99900,
    });
  });

  it('classifies a failed payment event', () => {
    const result = classifyWebhookEvent({
      type: 'PAYMENT_FAILED_WEBHOOK',
      data: { subscription: { subscriptionId: 'sub_123' }, payment: { cfPaymentId: 'pay_2' } },
    });
    expect(result).toEqual({ kind: 'payment_failed', gatewaySubscriptionId: 'sub_123', gatewayPaymentId: 'pay_2' });
  });

  it('returns unknown for an unrecognized event type', () => {
    expect(classifyWebhookEvent({ type: 'SOMETHING_ELSE' })).toEqual({ kind: 'unknown' });
  });
});
