const WhatsAppAccount = require('../src/repositories/whatsappAccount');

jest.mock('../src/repositories/whatsappAccount', () => ({
  findOne: jest.fn(),
  updateMany: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../src/services/whatsappAccountService', () => ({
  assertPhoneNumberAvailable: jest.fn().mockResolvedValue(),
  sanitizeAccount: (account) => account,
  resolveCurrentWhatsAppAccount: jest.fn(),
  loadActiveWhatsAppAccountForUser: jest.fn(),
  loadWhatsAppAccountByPhoneNumberId: jest.fn(),
  loadWhatsAppAccountFromWebhookIdentifiers: jest.fn(),
}));

const { activateAccount } = require('../src/controllers/whatsappController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('activateAccount — atomic activation (race-condition fix)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deactivates every other account first, then atomically activates only the target via findOneAndUpdate — not a read-then-.save() pattern', async () => {
    const targetAccount = { _id: 'acc-1', userId: 'user-1', status: 'active', phoneNumberId: '111' };
    WhatsAppAccount.findOne.mockResolvedValue(targetAccount);
    WhatsAppAccount.updateMany.mockResolvedValue({});
    const persistedAfterUpdate = { _id: 'acc-1', userId: 'user-1', status: 'active', isActive: true, numberClaimed: true };
    WhatsAppAccount.findOneAndUpdate.mockResolvedValue(persistedAfterUpdate);

    const req = { params: { id: 'acc-1' }, user: { id: 'user-1' } };
    const res = mockRes();

    await activateAccount(req, res, jest.fn());
    await new Promise((resolve) => setImmediate(resolve));

    expect(WhatsAppAccount.updateMany).toHaveBeenCalledWith(
      { userId: 'user-1', _id: { $ne: 'acc-1' } },
      { $set: { isActive: false } }
    );
    expect(WhatsAppAccount.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'acc-1', userId: 'user-1' },
      { $set: { isActive: true, numberClaimed: true } },
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: persistedAfterUpdate });
  });

  it('sets status to active only when reconnecting a previously disconnected account', async () => {
    const disconnectedAccount = { _id: 'acc-2', userId: 'user-1', status: 'disconnected', phoneNumberId: '222' };
    WhatsAppAccount.findOne.mockResolvedValue(disconnectedAccount);
    WhatsAppAccount.updateMany.mockResolvedValue({});
    WhatsAppAccount.findOneAndUpdate.mockResolvedValue({ _id: 'acc-2', status: 'active', isActive: true });

    const req = { params: { id: 'acc-2' }, user: { id: 'user-1' } };
    await activateAccount(req, mockRes(), jest.fn());
    await new Promise((resolve) => setImmediate(resolve));

    expect(WhatsAppAccount.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'acc-2', userId: 'user-1' },
      { $set: { isActive: true, numberClaimed: true, status: 'active' } },
      { new: true }
    );
  });

  it('returns a 409 when a concurrent activation already claimed the unique active slot', async () => {
    const account = { _id: 'acc-3', userId: 'user-1', status: 'active', phoneNumberId: '333' };
    WhatsAppAccount.findOne.mockResolvedValue(account);
    WhatsAppAccount.updateMany.mockResolvedValue({});
    const duplicateKeyError = Object.assign(new Error('duplicate'), { code: 11000 });
    WhatsAppAccount.findOneAndUpdate.mockRejectedValue(duplicateKeyError);

    const req = { params: { id: 'acc-3' }, user: { id: 'user-1' } };
    const next = jest.fn();

    // activateAccount is wrapped in asyncHandler, which forwards a thrown
    // AppError to next() rather than rejecting — wait for that microtask.
    await activateAccount(req, mockRes(), next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  });
});
