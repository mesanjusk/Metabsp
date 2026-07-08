const Message = require('../src/repositories/Message');
const { resolveCurrentWhatsAppAccount } = require('../src/services/whatsappAccountService');
const { enforceWhatsApp24hWindow } = require('../src/middleware/whatsapp24hGuard');

jest.mock('../src/repositories/Message', () => ({ findOne: jest.fn() }));
jest.mock('../src/services/whatsappAccountService', () => ({ resolveCurrentWhatsAppAccount: jest.fn() }));

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockFindOne = (lastMessage) => {
  Message.findOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(lastMessage) }) });
};

beforeEach(() => {
  jest.clearAllMocks();
  resolveCurrentWhatsAppAccount.mockResolvedValue({ account: { _id: 'acc-1' } });
});

describe('enforceWhatsApp24hWindow', () => {
  it('passes through when the route is not a recognized message-send path', async () => {
    const req = { path: '/api/whatsapp/settings', body: {}, originalUrl: '/api/whatsapp/settings' };
    const res = mockRes();
    const next = jest.fn();

    await enforceWhatsApp24hWindow(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(Message.findOne).not.toHaveBeenCalled();
  });

  it('allows a text send when the last incoming message was within 24h', async () => {
    mockFindOne({ timestamp: new Date(Date.now() - 60 * 60 * 1000) });
    const req = { path: '/api/whatsapp/send-text', body: { to: '919000000001' }, originalUrl: '/api/whatsapp/send-text', user: { id: 'u1' } };
    const res = mockRes();
    const next = jest.fn();

    await enforceWhatsApp24hWindow(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.whatsapp24hWindow.isInsideWindow).toBe(true);
  });

  it('blocks a text send when the window is closed (no recent incoming message)', async () => {
    mockFindOne(null);
    const req = { path: '/api/whatsapp/send-text', body: { to: '919000000001' }, originalUrl: '/api/whatsapp/send-text', user: { id: 'u1' } };
    const res = mockRes();
    const next = jest.fn();

    await enforceWhatsApp24hWindow(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks a text send when the last incoming message is older than 24h', async () => {
    mockFindOne({ timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    const req = { path: '/api/whatsapp/send-text', body: { to: '919000000001' }, originalUrl: '/api/whatsapp/send-text', user: { id: 'u1' } };
    const res = mockRes();
    const next = jest.fn();

    await enforceWhatsApp24hWindow(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('always allows template sends, even outside the window', async () => {
    mockFindOne(null);
    const req = { path: '/api/whatsapp/send-template', body: { to: '919000000001' }, originalUrl: '/api/whatsapp/send-template', user: { id: 'u1' } };
    const res = mockRes();
    const next = jest.fn();

    await enforceWhatsApp24hWindow(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.whatsapp24hWindow.isInsideWindow).toBe(false);
  });

  it('skips enforcement (and does not query) when no conversation identity can be resolved', async () => {
    const req = { path: '/api/whatsapp/send-text', body: {}, originalUrl: '/api/whatsapp/send-text', user: { id: 'u1' } };
    const res = mockRes();
    const next = jest.fn();

    await enforceWhatsApp24hWindow(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(Message.findOne).not.toHaveBeenCalled();
  });

  it('passes errors to next() instead of throwing', async () => {
    resolveCurrentWhatsAppAccount.mockRejectedValue(new Error('boom'));
    const req = { path: '/api/whatsapp/send-text', body: { to: '919000000001' }, originalUrl: '/api/whatsapp/send-text', user: { id: 'u1' } };
    const res = mockRes();
    const next = jest.fn();

    await enforceWhatsApp24hWindow(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
