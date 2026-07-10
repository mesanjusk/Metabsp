const mockFindById = jest.fn();

jest.mock('../bulk/models/Organization', () => ({
  findById: (...args) => mockFindById(...args),
}));

const { requireBaileysEnabled } = require('../bulk/middleware/baileysGate');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('requireBaileysEnabled', () => {
  it('allows through when req.tenantId is null (super admin / no org)', async () => {
    const req = { tenantId: null };
    const res = mockRes();
    const next = jest.fn();

    await requireBaileysEnabled(req, res, next);

    expect(mockFindById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('allows through when the org has baileysEnabled: true', async () => {
    mockFindById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ baileysEnabled: true }) }) });
    const req = { tenantId: 'org-1' };
    const res = mockRes();
    const next = jest.fn();

    await requireBaileysEnabled(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects with 403 when the org has baileysEnabled: false', async () => {
    mockFindById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ baileysEnabled: false }) }) });
    const req = { tenantId: 'org-2' };
    const res = mockRes();
    const next = jest.fn();

    await requireBaileysEnabled(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects with 403 when the org is not found', async () => {
    mockFindById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });
    const req = { tenantId: 'org-missing' };
    const res = mockRes();
    const next = jest.fn();

    await requireBaileysEnabled(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 500 if the lookup itself throws', async () => {
    mockFindById.mockImplementation(() => { throw new Error('db down'); });
    const req = { tenantId: 'org-3' };
    const res = mockRes();
    const next = jest.fn();

    await requireBaileysEnabled(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
