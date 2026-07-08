// Requires mongodb-memory-server (blocked in this sandbox, see
// tenantService.test.js) — not verified here, should run in CI.
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const axios = require('axios');

jest.mock('axios');

const WhatsAppAccount = require('../src/repositories/whatsappAccount');
const { encryptSensitiveValue, decryptSensitiveValue } = require('../src/utils/crypto');
const { refreshExpiringTokens } = require('../src/services/tokenRefreshService');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  process.env.META_APP_ID = 'test-app-id';
  process.env.META_APP_SECRET = 'test-app-secret';
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await WhatsAppAccount.deleteMany({});
  axios.get.mockReset();
});

async function makeAccount(overrides = {}) {
  return WhatsAppAccount.create({
    userId: new mongoose.Types.ObjectId(),
    phoneNumberId: '1500000000',
    accessTokenEncrypted: encryptSensitiveValue('old-token'),
    isActive: true,
    status: 'active',
    tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // expires in 1 day
    ...overrides,
  });
}

describe('tokenRefreshService.refreshExpiringTokens', () => {
  it('refreshes a token expiring soon and stores the new one encrypted', async () => {
    const account = await makeAccount();
    axios.get.mockResolvedValueOnce({ data: { access_token: 'new-token', expires_in: 5184000 } });

    const result = await refreshExpiringTokens();

    expect(result).toEqual({ checked: 1, refreshed: 1, failed: 0 });
    const reloaded = await WhatsAppAccount.findById(account._id);
    expect(decryptSensitiveValue(reloaded.accessTokenEncrypted)).toBe('new-token');
    expect(reloaded.status).toBe('active');
    expect(reloaded.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 24 * 60 * 60 * 1000);
  });

  it('marks the account as error when Meta rejects the refresh', async () => {
    const account = await makeAccount();
    axios.get.mockRejectedValueOnce(new Error('OAuthException: token expired'));

    const result = await refreshExpiringTokens();

    expect(result).toEqual({ checked: 1, refreshed: 0, failed: 1 });
    const reloaded = await WhatsAppAccount.findById(account._id);
    expect(reloaded.status).toBe('error');
  });

  it('ignores accounts whose token is not close to expiry', async () => {
    await makeAccount({ tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });

    const result = await refreshExpiringTokens();

    expect(result).toEqual({ checked: 0, refreshed: 0, failed: 0 });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('ignores accounts with no expiry set (e.g. never-expiring/legacy tokens)', async () => {
    await makeAccount({ tokenExpiresAt: null });

    const result = await refreshExpiringTokens();

    expect(result).toEqual({ checked: 0, refreshed: 0, failed: 0 });
  });
});
