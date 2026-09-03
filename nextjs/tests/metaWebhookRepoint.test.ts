import { describe, expect, it, vi, beforeEach } from 'vitest';

// The finding this file exists for, from a production boot log:
//
//   [preflight] webhook_fields: All required webhook fields subscribed
//   (messages). Meta delivers to: https://mis-both.onrender.com/webhook
//
// `messages` subscribed, subscription active, verify handshake passing — and
// every inbound message POSTed to a different, suspended service. The App
// Dashboard's Configuration page shows the URL you last typed into it, which
// is not the same stored value as the callback Meta holds for the
// whatsapp_business_account object subscription.
const axiosPost = vi.fn();
vi.mock('axios', () => ({ default: { post: (...args: any[]) => axiosPost(...args), get: vi.fn() } }));

const { compareCallbackUrls, subscribeAppWebhook } = await import('@/lib/services/metaWebhookSubscriptionService');

const HERE = 'https://meta.sanjusk.in/webhook';
const THERE = 'https://mis-both.onrender.com/webhook';

beforeEach(() => {
  vi.clearAllMocks();
  axiosPost.mockResolvedValue({ data: { success: true } });
  process.env.META_APP_ID = '1717826239505344';
  process.env.META_APP_SECRET = 'app-secret';
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'the-verify-token';
  delete process.env.META_ENABLE_COEXISTENCE;
});

describe('where Meta delivers versus where we listen', () => {
  it('calls out a different host as the outage it is', () => {
    const result = compareCallbackUrls({ current: THERE, expected: HERE });

    expect(result.state).toBe('elsewhere');
    expect(result.reason).toContain('mis-both.onrender.com');
    expect(result.reason).toContain('meta.sanjusk.in');
  });

  it('treats a trailing slash on the same host as a match, not an outage', () => {
    // Sending someone to repoint a subscription over a trailing slash would
    // waste the one action that actually matters.
    expect(compareCallbackUrls({ current: `${HERE}/`, expected: HERE }).state).toBe('match');
  });

  it('separates a different path on the same host from a different host', () => {
    // Same deployment, wrong route: worth flagging, but nothing is being
    // delivered to a third party.
    expect(compareCallbackUrls({ current: 'https://meta.sanjusk.in/api/hook', expected: HERE }).state).toBe('same_host');
  });

  it('reports an empty callback as unset rather than as a match', () => {
    expect(compareCallbackUrls({ current: '', expected: HERE }).state).toBe('unset');
  });

  it('does not guess when it cannot tell what this deployment is', () => {
    expect(compareCallbackUrls({ current: THERE, expected: '' }).state).toBe('unknown');
    expect(compareCallbackUrls({ current: 'not a url', expected: HERE }).state).toBe('unknown');
  });
});

describe('repointing the subscription', () => {
  it('writes the callback URL, verify token and fields Meta needs', async () => {
    await subscribeAppWebhook({ callbackUrl: HERE });

    const [url, body, config] = axiosPost.mock.calls[0];
    expect(url).toContain('/1717826239505344/subscriptions');
    expect(body).toBeNull();
    expect(config.params).toMatchObject({
      object: 'whatsapp_business_account',
      callback_url: HERE,
      verify_token: 'the-verify-token',
      fields: 'messages',
      access_token: '1717826239505344|app-secret',
    });
  });

  it('subscribes the coexistence fields too when coexistence is on', async () => {
    process.env.META_ENABLE_COEXISTENCE = 'true';

    await subscribeAppWebhook({ callbackUrl: HERE });

    expect(axiosPost.mock.calls[0][2].params.fields).toContain('messages');
    expect(axiosPost.mock.calls[0][2].params.fields.split(',').length).toBeGreaterThan(1);
  });

  it('refuses without a verify token, since Meta verifies before it stores', async () => {
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    delete process.env.VERIFY_TOKEN;

    await expect(subscribeAppWebhook({ callbackUrl: HERE })).rejects.toThrow(/verify token/i);
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it('refuses a non-https callback URL before asking Meta', async () => {
    await expect(subscribeAppWebhook({ callbackUrl: 'http://meta.sanjusk.in/webhook' })).rejects.toThrow(/https/);
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it('refuses when the app credentials are missing', async () => {
    delete process.env.META_APP_SECRET;
    delete process.env.WHATSAPP_APP_SECRET;

    await expect(subscribeAppWebhook({ callbackUrl: HERE })).rejects.toThrow(/META_APP_SECRET/);
  });

  it('surfaces why Meta refused, with the detail needed to act on it', async () => {
    axiosPost.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), {
        response: {
          status: 400,
          data: {
            error: {
              message: 'The URL couldn\'t be validated. Response does not match challenge',
              code: 2200,
              fbtrace_id: 'Zx9',
            },
          },
        },
      })
    );

    // 2200 is what Meta returns when it GET the callback URL and did not get
    // the challenge back — the difference between "Meta refused us" and "our
    // endpoint answered wrong", which sends you to different places.
    const error: any = await subscribeAppWebhook({ callbackUrl: HERE }).catch((e: any) => e);

    expect(error.message).toContain('does not match challenge');
    expect(error.message).toContain('code 2200');
    expect(error.message).toContain('fbtrace_id Zx9');
    expect(error.statusCode ?? error.status).toBe(502);
  });

  it('does not report success when Meta answers success:false', async () => {
    axiosPost.mockResolvedValueOnce({ data: { success: false } });

    await expect(subscribeAppWebhook({ callbackUrl: HERE })).rejects.toThrow(/rejected/i);
  });
});
