// Every Graph API call is mocked. This suite must never issue a real request
// to Meta — the assertions below check the shape of our own reasoning about
// Meta's responses, not Meta itself.
jest.mock('axios');
jest.mock('../src/repositories/whatsappAccount', () => ({ find: jest.fn() }));
jest.mock('../src/utils/crypto', () => ({
  decryptSensitiveValue: jest.fn(() => 'decrypted-token'),
  encryptSensitiveValue: jest.fn((v) => `enc:${v}`),
}));

const axios = require('axios');
const WhatsAppAccount = require('../src/repositories/whatsappAccount');
const {
  ALL_WEBHOOK_FIELDS,
  isCoexistenceEnabled,
  fetchAppWebhookFields,
  fetchWabaSubscription,
  checkWebhookFields,
  checkCoexistenceGating,
  checkTokenSources,
  runPreflightChecks,
} = require('../src/services/preflightCheckService');

const ENV_KEYS = ['META_ENABLE_COEXISTENCE', 'META_APP_ID', 'META_APP_SECRET', 'RUN_PREFLIGHT_ON_BOOT'];
const originalEnv = {};

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
  process.env.META_APP_ID = '1717826239505344';
  process.env.META_APP_SECRET = 'test-secret';
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k];
  }
});

const fieldsResponse = (names) => ({
  data: { data: [{ object: 'whatsapp_business_account', callback_url: 'https://x/webhook', active: true, fields: names.map((name) => ({ name, version: 'v20.0' })) }] },
});

describe('isCoexistenceEnabled', () => {
  it('defaults to on and is disabled only by an explicit false', () => {
    delete process.env.META_ENABLE_COEXISTENCE;
    expect(isCoexistenceEnabled()).toBe(true);
    process.env.META_ENABLE_COEXISTENCE = 'false';
    expect(isCoexistenceEnabled()).toBe(false);
    process.env.META_ENABLE_COEXISTENCE = 'FALSE';
    expect(isCoexistenceEnabled()).toBe(false);
    process.env.META_ENABLE_COEXISTENCE = 'true';
    expect(isCoexistenceEnabled()).toBe(true);
  });

  it('matches getConnectConfig, so the check and the popup cannot disagree', () => {
    // Same expression as controllers/whatsappController.js:isCoexistenceEnabled.
    for (const value of ['', 'no', '0', 'yes']) {
      process.env.META_ENABLE_COEXISTENCE = value;
      expect(isCoexistenceEnabled()).toBe(value.toLowerCase() !== 'false');
    }
  });
});

describe('fetchAppWebhookFields', () => {
  it('reads subscribed fields with an app access token, never a customer token', async () => {
    axios.get.mockResolvedValue(fieldsResponse(['messages', 'history']));

    const result = await fetchAppWebhookFields({ graphVersion: 'v20.0' });

    expect(result).toMatchObject({ status: 'ok', fields: ['messages', 'history'], active: true });
    const [url, config] = axios.get.mock.calls[0];
    expect(url).toContain('/1717826239505344/subscriptions');
    expect(config.params.access_token).toBe('1717826239505344|test-secret');
    expect(JSON.stringify(config)).not.toContain('Bearer');
  });

  it('accepts bare-string fields as well as {name} objects', async () => {
    axios.get.mockResolvedValue({ data: { data: [{ object: 'whatsapp_business_account', fields: ['messages', 'smb_message_echoes'] }] } });
    const result = await fetchAppWebhookFields();
    expect(result.fields).toEqual(['messages', 'smb_message_echoes']);
  });

  it('reports not_subscribed when the app has no whatsapp_business_account subscription', async () => {
    axios.get.mockResolvedValue({ data: { data: [{ object: 'page', fields: [] }] } });
    expect((await fetchAppWebhookFields()).status).toBe('not_subscribed');
  });

  it('degrades to unknown rather than throwing when Meta errors', async () => {
    axios.get.mockRejectedValue({ response: { data: { error: { message: 'Invalid OAuth token' } } } });
    const result = await fetchAppWebhookFields();
    expect(result).toMatchObject({ status: 'unknown', reason: 'Invalid OAuth token', fields: [] });
  });

  it('does not call Meta at all when app credentials are missing', async () => {
    delete process.env.META_APP_SECRET;
    const result = await fetchAppWebhookFields({ appSecret: '' });
    expect(result.status).toBe('unknown');
    expect(axios.get).not.toHaveBeenCalled();
  });
});

describe('checkWebhookFields', () => {
  it('is ok when every coexistence field is subscribed and coexistence is on', () => {
    const check = checkWebhookFields({ status: 'ok', fields: ALL_WEBHOOK_FIELDS, active: true }, { coexistenceEnabled: true });
    expect(check.severity).toBe('ok');
    expect(check.missing).toEqual([]);
  });

  it('errors, naming the missing fields, when coexistence is on but they are unsubscribed', () => {
    const check = checkWebhookFields({ status: 'ok', fields: ['messages'], active: true }, { coexistenceEnabled: true });

    expect(check.severity).toBe('error');
    expect(check.missing).toEqual(['history', 'smb_message_echoes', 'smb_app_state_sync']);
    // The warning has to say what actually goes wrong, not just "missing".
    expect(check.summary).toMatch(/silently drop/);
    expect(check.summary).toMatch(/META_ENABLE_COEXISTENCE=false/);
  });

  it('is ok with only `messages` when coexistence is off, but flags what blocks enabling it', () => {
    const check = checkWebhookFields({ status: 'ok', fields: ['messages'], active: true }, { coexistenceEnabled: false });
    expect(check.severity).toBe('ok');
    expect(check.notReadyForCoexistence).toEqual(['history', 'smb_message_echoes', 'smb_app_state_sync']);
  });

  it('warns when the subscription exists but Meta marks it inactive', () => {
    const check = checkWebhookFields({ status: 'ok', fields: ALL_WEBHOOK_FIELDS, active: false }, { coexistenceEnabled: true });
    expect(check.severity).toBe('warn');
  });

  it('escalates to error when the app has no whatsapp subscription at all', () => {
    const check = checkWebhookFields({ status: 'not_subscribed', fields: [] }, { coexistenceEnabled: false });
    expect(check.severity).toBe('error');
  });
});

describe('checkCoexistenceGating', () => {
  it('errors on the dangerous combination: flag on, fields unsubscribed', () => {
    const fieldCheck = checkWebhookFields({ status: 'ok', fields: ['messages'], active: true }, { coexistenceEnabled: true });
    const gate = checkCoexistenceGating({ coexistenceEnabled: true, fieldCheck, coexistenceAccountCount: 0 });
    expect(gate.severity).toBe('error');
    expect(gate.summary).toMatch(/META_ENABLE_COEXISTENCE=false/);
  });

  it('is ok when the flag is on and the fields are there', () => {
    const fieldCheck = checkWebhookFields({ status: 'ok', fields: ALL_WEBHOOK_FIELDS, active: true }, { coexistenceEnabled: true });
    expect(checkCoexistenceGating({ coexistenceEnabled: true, fieldCheck, coexistenceAccountCount: 2 }).severity).toBe('ok');
  });

  it('warns when coexistence accounts already exist but the flag was turned off', () => {
    const fieldCheck = checkWebhookFields({ status: 'ok', fields: ['messages'], active: true }, { coexistenceEnabled: false });
    const gate = checkCoexistenceGating({ coexistenceEnabled: false, fieldCheck, coexistenceAccountCount: 3 });
    expect(gate.severity).toBe('warn');
    expect(gate.summary).toMatch(/3 account/);
  });

  it('is ok when the flag is off and nothing is connected in coexistence mode', () => {
    const fieldCheck = checkWebhookFields({ status: 'ok', fields: ['messages'], active: true }, { coexistenceEnabled: false });
    expect(checkCoexistenceGating({ coexistenceEnabled: false, fieldCheck, coexistenceAccountCount: 0 }).severity).toBe('ok');
  });
});

describe('checkTokenSources', () => {
  const now = new Date('2026-08-25T00:00:00Z').getTime();
  const account = (over = {}) => ({ _id: 'a1', phoneNumberId: '111', connectionMode: 'embedded_signup', ...over });

  it('is ok for a System User token with no expiry', () => {
    const check = checkTokenSources([account({ tokenSource: 'system_user', tokenExpiresAt: null })], { now });
    expect(check.severity).toBe('ok');
    expect(check.summary).toBe('1/1 active account(s) using a System User token');
  });

  it('warns on a user token, per Meta BSP guidance', () => {
    const check = checkTokenSources([account({ tokenSource: 'user_token' })], { now });
    expect(check.severity).toBe('warn');
    expect(check.accounts[0].note).toMatch(/System User token/);
  });

  it('warns when a token is near expiry and errors once it has passed', () => {
    const soon = new Date(now + 3 * 86400000);
    const past = new Date(now - 86400000);
    expect(checkTokenSources([account({ tokenSource: 'system_user', tokenExpiresAt: soon })], { now }).severity).toBe('warn');
    expect(checkTokenSources([account({ tokenSource: 'system_user', tokenExpiresAt: past })], { now }).severity).toBe('error');
  });

  it('reports the worst account severity across a mixed fleet', () => {
    const check = checkTokenSources(
      [
        account({ _id: 'a1', tokenSource: 'system_user' }),
        account({ _id: 'a2', tokenSource: 'user_token', tokenExpiresAt: new Date(now - 1000) }),
      ],
      { now }
    );
    expect(check.severity).toBe('error');
    expect(check.summary).toBe('1/2 active account(s) using a System User token');
  });

  it('handles having no connected accounts', () => {
    const check = checkTokenSources([], { now });
    expect(check.severity).toBe('ok');
    expect(check.summary).toBe('No active WhatsApp accounts connected');
  });
});

describe('fetchWabaSubscription', () => {
  it('confirms this app is attached to the WABA', async () => {
    axios.get.mockResolvedValue({ data: { data: [{ whatsapp_business_api_data: { id: '1717826239505344' } }] } });
    const result = await fetchWabaSubscription({ wabaId: '999', accessToken: 't' });
    expect(result.status).toBe('ok');
  });

  it('reports not_subscribed when only some other app is attached', async () => {
    axios.get.mockResolvedValue({ data: { data: [{ whatsapp_business_api_data: { id: '999999' } }] } });
    expect((await fetchWabaSubscription({ wabaId: '999', accessToken: 't' })).status).toBe('not_subscribed');
  });
});

describe('runPreflightChecks', () => {
  const mockAccounts = (accounts) =>
    WhatsAppAccount.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(accounts) }) });

  it('aggregates to the worst severity across all checks', async () => {
    process.env.META_ENABLE_COEXISTENCE = 'true';
    axios.get.mockResolvedValue(fieldsResponse(['messages']));
    mockAccounts([{ _id: 'a1', phoneNumberId: '111', tokenSource: 'system_user', connectionMode: 'coexistence' }]);

    const report = await runPreflightChecks();

    expect(report.severity).toBe('error');
    expect(report.coexistenceEnabled).toBe(true);
    expect(report.checks.map((c) => c.id)).toEqual(['webhook_fields', 'coexistence_gating', 'token_sources']);
  });

  it('reports ok for a fully configured deployment', async () => {
    process.env.META_ENABLE_COEXISTENCE = 'true';
    axios.get.mockResolvedValue(fieldsResponse(ALL_WEBHOOK_FIELDS));
    mockAccounts([{ _id: 'a1', phoneNumberId: '111', tokenSource: 'system_user', connectionMode: 'coexistence' }]);

    expect((await runPreflightChecks()).severity).toBe('ok');
  });

  it('skips per-WABA Graph calls unless explicitly asked for', async () => {
    axios.get.mockResolvedValue(fieldsResponse(ALL_WEBHOOK_FIELDS));
    mockAccounts([{ _id: 'a1', phoneNumberId: '111', wabaId: '999', tokenSource: 'system_user', accessTokenEncrypted: 'enc' }]);

    const without = await runPreflightChecks();
    expect(without.checks.find((c) => c.id === 'waba_subscriptions')).toBeUndefined();
    expect(axios.get).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    axios.get.mockResolvedValue(fieldsResponse(ALL_WEBHOOK_FIELDS));
    mockAccounts([{ _id: 'a1', phoneNumberId: '111', wabaId: '999', tokenSource: 'system_user', accessTokenEncrypted: 'enc' }]);
    const withWabas = await runPreflightChecks({ includeWabaSubscriptions: true });
    expect(withWabas.checks.find((c) => c.id === 'waba_subscriptions')).toBeDefined();
  });

  it('still produces a report when the database is unreachable', async () => {
    axios.get.mockResolvedValue(fieldsResponse(ALL_WEBHOOK_FIELDS));
    WhatsAppAccount.find.mockImplementation(() => { throw new Error('Mongo down'); });

    const report = await runPreflightChecks();
    expect(report.checks.find((c) => c.id === 'token_sources').summary).toBe('No active WhatsApp accounts connected');
  });
});
