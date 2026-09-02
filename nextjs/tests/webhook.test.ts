import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

const enqueueWebhookEnvelope = vi.fn(async () => ({ id: '1' }));
vi.mock('@/lib/queues/webhookQueue', () => ({ enqueueWebhookEnvelope }));
vi.mock('@/lib/queues/whatsappSendQueue', () => ({ enqueueDelayedReply: vi.fn() }));

// Read once at module load by the handler, so it has to be set before the
// import below. Short enough to keep the "Redis never answers" test honest
// about waiting for a real timer rather than a mocked clock.
const ENQUEUE_TIMEOUT_MS = 50;
process.env.WEBHOOK_ENQUEUE_TIMEOUT_MS = String(ENQUEUE_TIMEOUT_MS);

const { handleVerifyWebhook, handleReceiveWebhook } = await import('@/lib/whatsapp/webhookHandler');

const APP_SECRET = 'test-app-secret';

const sign = (body: string) =>
  'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');

const post = (body: unknown, headers: Record<string, string> = {}) => {
  const raw = JSON.stringify(body);
  return new NextRequest('https://example.test/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: raw,
  });
};

describe('Meta webhook — verification handshake', () => {
  beforeEach(() => {
    // getWebhookVerifyToken() falls back to two older names, so the
    // "no verify token configured" case has to clear all three.
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    delete process.env.VERIFY_TOKEN;
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'the-verify-token';
  });

  it('echoes the challenge for the correct verify token', async () => {
    const req = new NextRequest(
      'https://example.test/webhook?hub.mode=subscribe&hub.verify_token=the-verify-token&hub.challenge=abc123'
    );
    const res = await handleVerifyWebhook(req);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('abc123');
  });

  it('rejects a wrong verify token', async () => {
    const req = new NextRequest(
      'https://example.test/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123'
    );
    expect((await handleVerifyWebhook(req)).status).toBe(403);
  });

  it('refuses to verify at all when no verify token is configured', async () => {
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    const req = new NextRequest(
      'https://example.test/webhook?hub.mode=subscribe&hub.verify_token=&hub.challenge=abc123'
    );
    // Must not accept an empty token as a match — that would let anyone
    // register their own endpoint against this app.
    expect((await handleVerifyWebhook(req)).status).toBe(403);
  });
});

describe('Meta webhook — signature enforcement and fast acknowledgement', () => {
  beforeEach(() => {
    enqueueWebhookEnvelope.mockClear();
    delete process.env.WHATSAPP_APP_SECRET;
    process.env.META_APP_SECRET = APP_SECRET;
    process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE = 'true';
  });

  afterEach(() => {
    delete process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE;
  });

  it('rejects an unsigned payload', async () => {
    const res = await handleReceiveWebhook(post({ object: 'whatsapp_business_account', entry: [] }));
    expect(res.status).toBe(403);
    expect(enqueueWebhookEnvelope).not.toHaveBeenCalled();
  });

  it('rejects a payload signed with the wrong secret', async () => {
    const body = { object: 'whatsapp_business_account', entry: [] };
    const wrong = 'sha256=' + crypto.createHmac('sha256', 'not-the-secret').update(JSON.stringify(body)).digest('hex');

    const res = await handleReceiveWebhook(post(body, { 'x-hub-signature-256': wrong }));
    expect(res.status).toBe(403);
    expect(enqueueWebhookEnvelope).not.toHaveBeenCalled();
  });

  it('refuses everything when enforcement is on but no app secret is configured', async () => {
    // WHATSAPP_APP_SECRET too: the handler accepts it as a legacy alias, so
    // deleting only META_APP_SECRET leaves this asserting a 403 that the
    // missing signature header would have produced anyway — passing for the
    // wrong reason on any machine where the alias is set, as it is on the
    // deployment host.
    delete process.env.META_APP_SECRET;
    delete process.env.WHATSAPP_APP_SECRET;

    const res = await handleReceiveWebhook(post({ object: 'whatsapp_business_account' }));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Webhook signature verification not configured');
  });

  it('accepts a correctly signed payload and queues it instead of processing inline', async () => {
    const body = { object: 'whatsapp_business_account', entry: [{ id: 'WABA1', changes: [] }] };
    const res = await handleReceiveWebhook(post(body, { 'x-hub-signature-256': sign(JSON.stringify(body)) }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, queued: true });
    expect(enqueueWebhookEnvelope).toHaveBeenCalledWith(body);
  });

  it('acknowledges but ignores a non-WhatsApp object sharing the same URL', async () => {
    const body = { object: 'page', entry: [{ id: '123', changes: [] }] };
    const res = await handleReceiveWebhook(post(body, { 'x-hub-signature-256': sign(JSON.stringify(body)) }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, ignored: true });
    expect(enqueueWebhookEnvelope).not.toHaveBeenCalled();
  });

  it('never answers 5xx when the queue is down — it falls back to inline processing', async () => {
    // A 5xx is what eventually gets a webhook subscription disabled by Meta,
    // so a Redis outage must not produce one. The payload is processed in the
    // request instead, which is slower but keeps the message.
    enqueueWebhookEnvelope.mockRejectedValueOnce(new Error('redis down'));
    const body = { object: 'whatsapp_business_account', entry: [] };

    const res = await handleReceiveWebhook(post(body, { 'x-hub-signature-256': sign(JSON.stringify(body)) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, queued: false });
  });

  it('falls back to inline processing when the enqueue never settles at all', async () => {
    // The failure the test above cannot express, and the one that actually
    // happens: the shared Redis connection is built with
    // maxRetriesPerRequest:null and the offline queue on, so a command issued
    // while Redis is unreachable is buffered and retried forever. It does not
    // reject — it hangs. Without a bound, the request hung with it until the
    // platform killed it, Meta recorded a timeout instead of a 200, and
    // enough of those disable the subscription.
    enqueueWebhookEnvelope.mockImplementationOnce(() => new Promise(() => {}) as any);
    const body = { object: 'whatsapp_business_account', entry: [] };

    const startedAt = Date.now();
    const res = await handleReceiveWebhook(post(body, { 'x-hub-signature-256': sign(JSON.stringify(body)) }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, queued: false });
    // Bounded by the timeout rather than by the promise, which is the point.
    expect(Date.now() - startedAt).toBeLessThan(ENQUEUE_TIMEOUT_MS + 2000);
  });
});
