const WhatsAppAccount = require('../src/repositories/whatsappAccount');
const { refreshExpiringTokens } = require('../src/services/tokenRefreshService');

jest.mock('../src/repositories/whatsappAccount', () => ({ find: jest.fn() }));

describe('tokenRefreshService.refreshExpiringTokens — query shape', () => {
  const originalAppId = process.env.META_APP_ID;
  const originalAppSecret = process.env.META_APP_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.META_APP_ID = 'app-id';
    process.env.META_APP_SECRET = 'app-secret';
    WhatsAppAccount.find.mockResolvedValue([]);
  });

  afterAll(() => {
    process.env.META_APP_ID = originalAppId;
    process.env.META_APP_SECRET = originalAppSecret;
  });

  it('excludes system_user-sourced accounts from the refresh candidate query', async () => {
    await refreshExpiringTokens();

    expect(WhatsAppAccount.find).toHaveBeenCalledWith(
      expect.objectContaining({ tokenSource: { $ne: 'system_user' } })
    );
  });

  it('short-circuits without querying when Meta app credentials are unset', async () => {
    delete process.env.META_APP_ID;

    const result = await refreshExpiringTokens();

    expect(WhatsAppAccount.find).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 0, refreshed: 0, failed: 0 });
  });
});
