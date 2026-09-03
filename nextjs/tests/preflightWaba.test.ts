import { describe, expect, it, vi, beforeEach } from 'vitest';

// The per-WABA subscription is the one stage the app-level field check cannot
// speak for, and the two are routinely confused: `messages` can be subscribed,
// the callback URL verified, and a given WABA still deliver nothing because
// this app was never attached to it. These tests are about that check running
// at boot and naming the WABA it failed on, since a login-gated answer is no
// answer when the question is being asked of a log.
const find = vi.fn();
const select = vi.fn();
const lean = vi.fn();

vi.mock('@/lib/models/WhatsAppAccount', () => ({
  default: { find: (...args: any[]) => find(...args) },
}));

const axiosGet = vi.fn();
vi.mock('axios', () => ({ default: { get: (...args: any[]) => axiosGet(...args) } }));

const info = vi.fn();
const warn = vi.fn();
const error = vi.fn();
vi.mock('@/lib/utils/logger', () => ({ default: { info, warn, error, debug: vi.fn() } }));

vi.mock('@/lib/utils/crypto', () => ({ decryptSensitiveValue: () => 'a-token' }));

const { runPreflightChecks, logPreflightReport, WABA_CHECK_AUTO_LIMIT } = await import(
  '@/lib/services/preflightCheckService'
);

const account = (n: number) => ({
  _id: `acct-${n}`,
  phoneNumberId: `pn-${n}`,
  wabaId: `waba-${n}`,
  accessTokenEncrypted: 'cipher',
  connectionMode: 'cloud_api',
  tokenSource: 'system_user',
});

const givenAccounts = (accounts: any[]) => {
  lean.mockResolvedValue(accounts);
  select.mockReturnValue({ lean });
  find.mockReturnValue({ select });
};

const loggedLines = () =>
  [...info.mock.calls, ...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_APP_ID = 'app-1';
  process.env.META_APP_SECRET = 'secret-1';
  process.env.META_ENABLE_COEXISTENCE = 'false';

  // App-level subscription: healthy, with `messages` ticked. Every test here
  // holds this fixed, because the finding under test is the one that survives
  // an app-level check that passes.
  axiosGet.mockImplementation(async (url: string) => {
    if (url.includes('/subscriptions')) {
      return {
        data: { data: [{ object: 'whatsapp_business_account', fields: [{ name: 'messages' }], callback_url: 'https://x.test/webhook', active: true }] },
      };
    }
    return { data: { data: [{ whatsapp_business_api_data: { id: 'app-1' } }] } };
  });
});

describe('preflight — the per-WABA subscription at boot', () => {
  it('runs the check on a deployment with few WABAs', async () => {
    givenAccounts([account(1)]);

    const report = await runPreflightChecks({ includeWabaSubscriptions: 'auto' });

    expect(report.checks.map((c: any) => c.id)).toContain('waba_subscriptions');
  });

  it('skips it once there are more WABAs than it is cheap to check at boot', async () => {
    givenAccounts(Array.from({ length: WABA_CHECK_AUTO_LIMIT + 1 }, (_v, i) => account(i)));

    const report = await runPreflightChecks({ includeWabaSubscriptions: 'auto' });

    expect(report.checks.map((c: any) => c.id)).not.toContain('waba_subscriptions');
  });

  it('skips it when no account has a WABA id to check', async () => {
    givenAccounts([{ ...account(1), wabaId: '' }]);

    const report = await runPreflightChecks({ includeWabaSubscriptions: 'auto' });

    expect(report.checks.map((c: any) => c.id)).not.toContain('waba_subscriptions');
  });

  it('still honours an explicit true and an explicit false', async () => {
    givenAccounts([account(1)]);
    expect((await runPreflightChecks({ includeWabaSubscriptions: true })).checks.map((c: any) => c.id)).toContain(
      'waba_subscriptions'
    );
    expect((await runPreflightChecks({ includeWabaSubscriptions: false })).checks.map((c: any) => c.id)).not.toContain(
      'waba_subscriptions'
    );
  });
});

describe('preflight — where Meta actually delivers', () => {
  it('names the callback URL in the log line, not just in the payload', async () => {
    // "The fields are subscribed" says nothing about where deliveries go, and
    // Meta stores one callback URL per app. A URL left pointing at a previous
    // host looks like a healthy subscription from every other angle.
    givenAccounts([account(1)]);

    logPreflightReport(await runPreflightChecks({ includeWabaSubscriptions: false }));

    expect(loggedLines()).toContainEqual(expect.stringContaining('Meta delivers to: https://x.test/webhook'));
  });

  it('says so loudly when Meta has marked the subscription inactive', async () => {
    givenAccounts([account(1)]);
    axiosGet.mockImplementation(async (url: string) => {
      if (url.includes('/subscriptions')) {
        return {
          data: {
            data: [
              {
                object: 'whatsapp_business_account',
                fields: [{ name: 'messages' }],
                callback_url: 'https://x.test/webhook',
                active: false,
              },
            ],
          },
        };
      }
      return { data: { data: [] } };
    });

    logPreflightReport(await runPreflightChecks({ includeWabaSubscriptions: false }));

    expect(loggedLines()).toContainEqual(expect.stringContaining('INACTIVE'));
  });
});

describe('preflight — reporting an unsubscribed WABA', () => {
  it('names the WABA and its number rather than only counting them', async () => {
    givenAccounts([account(1)]);
    // The failure this whole check exists for: the app is not in this WABA's
    // subscribed_apps, so nothing is delivered for it no matter how the
    // app-level fields are configured.
    axiosGet.mockImplementation(async (url: string) => {
      if (url.includes('/subscriptions')) {
        return {
          data: { data: [{ object: 'whatsapp_business_account', fields: [{ name: 'messages' }], callback_url: 'https://x.test/webhook', active: true }] },
        };
      }
      return { data: { data: [{ whatsapp_business_api_data: { id: 'some-other-app' } }] } };
    });

    logPreflightReport(await runPreflightChecks({ includeWabaSubscriptions: 'auto' }));

    const lines = loggedLines();
    expect(lines).toContainEqual(expect.stringContaining('WABA waba-1'));
    expect(lines).toContainEqual(expect.stringContaining('phone_number_id pn-1'));
    expect(lines).toContainEqual(expect.stringContaining('NOT in the WABA'));
  });

  it('says nothing per-account when every WABA is subscribed', async () => {
    givenAccounts([account(1)]);

    logPreflightReport(await runPreflightChecks({ includeWabaSubscriptions: 'auto' }));

    // The summary line still reports 1/1; only the per-account detail is
    // reserved for the ones that need attention.
    expect(loggedLines()).not.toContainEqual(expect.stringContaining('WABA waba-1 '));
  });

  it('reports a WABA it could not verify without calling it subscribed', async () => {
    givenAccounts([account(1)]);
    axiosGet.mockImplementation(async (url: string) => {
      if (url.includes('/subscriptions')) {
        return {
          data: { data: [{ object: 'whatsapp_business_account', fields: [{ name: 'messages' }], callback_url: 'https://x.test/webhook', active: true }] },
        };
      }
      throw Object.assign(new Error('Request failed'), {
        response: { data: { error: { message: 'Unsupported get request' } } },
      });
    });

    logPreflightReport(await runPreflightChecks({ includeWabaSubscriptions: 'auto' }));

    expect(loggedLines()).toContainEqual(expect.stringContaining('Could not verify'));
  });
});
