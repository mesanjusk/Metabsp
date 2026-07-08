describe('config/graphApi', () => {
  const ENV_KEYS = ['WHATSAPP_API_VERSION', 'META_API_VERSION', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'WHATSAPP_VERIFY_TOKEN', 'VERIFY_TOKEN'];
  let originalEnv;

  beforeEach(() => {
    originalEnv = {};
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    jest.resetModules();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it('falls back to the hardcoded default when nothing is set', () => {
    const { getGraphApiVersion } = require('../src/config/graphApi');
    expect(getGraphApiVersion()).toBe('v20.0');
  });

  it('prefers WHATSAPP_API_VERSION over the legacy META_API_VERSION alias', () => {
    process.env.WHATSAPP_API_VERSION = 'v21.0';
    process.env.META_API_VERSION = 'v18.0';
    const { getGraphApiVersion } = require('../src/config/graphApi');
    expect(getGraphApiVersion()).toBe('v21.0');
  });

  it('falls back to META_API_VERSION when WHATSAPP_API_VERSION is unset', () => {
    process.env.META_API_VERSION = 'v19.0';
    const { getGraphApiVersion } = require('../src/config/graphApi');
    expect(getGraphApiVersion()).toBe('v19.0');
  });

  it('resolves the webhook verify token across all three legacy env var names', () => {
    process.env.VERIFY_TOKEN = 'legacy-token';
    const { getWebhookVerifyToken } = require('../src/config/graphApi');
    expect(getWebhookVerifyToken()).toBe('legacy-token');
  });

  it('prefers WHATSAPP_WEBHOOK_VERIFY_TOKEN over both legacy aliases', () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'primary-token';
    process.env.WHATSAPP_VERIFY_TOKEN = 'secondary-token';
    process.env.VERIFY_TOKEN = 'tertiary-token';
    const { getWebhookVerifyToken } = require('../src/config/graphApi');
    expect(getWebhookVerifyToken()).toBe('primary-token');
  });

  it('returns an empty string rather than undefined when nothing is set', () => {
    const { getWebhookVerifyToken } = require('../src/config/graphApi');
    expect(getWebhookVerifyToken()).toBe('');
  });
});
