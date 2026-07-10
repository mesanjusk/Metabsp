const ApiKey = require('../bulk/models/ApiKey');
const User = require('../bulk/models/User');
const { requireApiKey } = require('../src/middleware/apiKeyAuth');

jest.mock('../bulk/models/ApiKey', () => ({
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../bulk/models/User', () => ({
  findById: jest.fn(),
}));

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('requireApiKey', () => {
  it('rejects when no API key header/query is present', async () => {
    const req = { headers: {}, query: {} };
    const res = mockRes();
    const next = jest.fn();

    await requireApiKey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an invalid or revoked key', async () => {
    ApiKey.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const req = { headers: { 'x-api-key': 'mbsp_bad' }, query: {} };
    const res = mockRes();
    const next = jest.fn();

    await requireApiKey(req, res, next);

    expect(ApiKey.findOne).toHaveBeenCalledWith({ key: 'mbsp_bad', isActive: true });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid key from the header, attaches req.user + req.tenantId, and updates lastUsedAt', async () => {
    ApiKey.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'key-1', userId: 'user-1', key: 'mbsp_good', isActive: true }) });
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ tenantId: 'org-1' }) }) });
    ApiKey.findByIdAndUpdate.mockResolvedValue({});
    const req = { headers: { 'x-api-key': 'mbsp_good' }, query: {} };
    const res = mockRes();
    const next = jest.fn();

    await requireApiKey(req, res, next);

    expect(req.user).toEqual({ id: 'user-1' });
    expect(req.tenantId).toBe('org-1');
    expect(next).toHaveBeenCalled();
    expect(ApiKey.findByIdAndUpdate).toHaveBeenCalledWith('key-1', { lastUsedAt: expect.any(Date) });
  });

  it('accepts a key passed via the apiKey query param', async () => {
    ApiKey.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'key-2', userId: 'user-2', key: 'mbsp_q', isActive: true }) });
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ tenantId: null }) }) });
    ApiKey.findByIdAndUpdate.mockResolvedValue({});
    const req = { headers: {}, query: { apiKey: 'mbsp_q' } };
    const res = mockRes();
    const next = jest.fn();

    await requireApiKey(req, res, next);

    expect(req.user).toEqual({ id: 'user-2' });
    expect(next).toHaveBeenCalled();
  });

  it('defaults req.tenantId to null and still calls next() if the tenantId lookup itself fails', async () => {
    ApiKey.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'key-3', userId: 'user-3', key: 'mbsp_broken', isActive: true }) });
    User.findById.mockImplementation(() => { throw new Error('CastError'); });
    ApiKey.findByIdAndUpdate.mockResolvedValue({});
    const req = { headers: { 'x-api-key': 'mbsp_broken' }, query: {} };
    const res = mockRes();
    const next = jest.fn();

    await requireApiKey(req, res, next);

    expect(req.user).toEqual({ id: 'user-3' });
    expect(req.tenantId).toBeNull();
    expect(next).toHaveBeenCalled();
  });
});
