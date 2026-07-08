const WhatsAppAccount = require('../src/repositories/whatsappAccount');
const { resolveActiveWhatsAppAccount } = require('../src/services/whatsappAccountService');

jest.mock('../src/repositories/whatsappAccount', () => ({ findOne: jest.fn() }));

const chain = (resolvedValue) => ({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(resolvedValue) }) });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loadActiveWhatsAppAccountForUser — team inbox fallback', () => {
  it('returns the user\'s own active account when they own one, without checking team membership', async () => {
    const ownedAccount = { _id: 'acc-1', userId: 'user-1', phoneNumberId: '1', status: 'active', accessTokenEncrypted: '' };
    WhatsAppAccount.findOne.mockReturnValueOnce(chain(ownedAccount));

    const result = await resolveActiveWhatsAppAccount('user-1');

    expect(result.account._id).toBe('acc-1');
    expect(WhatsAppAccount.findOne).toHaveBeenCalledTimes(1);
    expect(WhatsAppAccount.findOne).toHaveBeenCalledWith({ userId: 'user-1', isActive: true, status: { $ne: 'disconnected' } });
  });

  it('falls back to a shared account where the user is a team member when they own none', async () => {
    const sharedAccount = { _id: 'acc-2', userId: 'owner-9', teamMemberIds: ['user-1'], phoneNumberId: '2', status: 'active', accessTokenEncrypted: '' };
    WhatsAppAccount.findOne
      .mockReturnValueOnce(chain(null)) // owned + isActive
      .mockReturnValueOnce(chain(null)) // owned, any status
      .mockReturnValueOnce(chain(sharedAccount)); // team membership fallback

    const result = await resolveActiveWhatsAppAccount('user-1');

    expect(result.account._id).toBe('acc-2');
    expect(WhatsAppAccount.findOne).toHaveBeenNthCalledWith(3, { teamMemberIds: 'user-1', status: { $ne: 'disconnected' } });
  });

  it('returns null (not throwing) when requireAccount is false and the user has no owned or shared account', async () => {
    WhatsAppAccount.findOne
      .mockReturnValueOnce(chain(null))
      .mockReturnValueOnce(chain(null))
      .mockReturnValueOnce(chain(null));

    const result = await resolveActiveWhatsAppAccount('user-1', { requireAccount: false });

    expect(result).toBeNull();
  });
});
