const AuditLog = require('../src/models/AuditLog');
const { recordAuditEvent } = require('../src/services/auditLogService');

jest.mock('../src/models/AuditLog', () => ({
  create: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auditLogService.recordAuditEvent', () => {
  it('extracts userId, ip, and user-agent from req when not given explicitly', async () => {
    AuditLog.create.mockResolvedValue({});
    const req = { user: { id: 'user-1' }, ip: '203.0.113.5', headers: { 'user-agent': 'jest-test-agent' } };

    await recordAuditEvent({ req, action: 'login', resource: 'user', resourceId: 'user-1' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'login',
        resource: 'user',
        resourceId: 'user-1',
        outcome: 'success',
        ipAddress: '203.0.113.5',
        userAgent: 'jest-test-agent',
      })
    );
  });

  it('prefers an explicitly given userId over req.user.id', async () => {
    AuditLog.create.mockResolvedValue({});
    const req = { user: { id: 'user-1' } };

    await recordAuditEvent({ req, userId: 'explicit-user', action: 'whatsapp_account.connect' });

    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'explicit-user' }));
  });

  it('defaults missing fields to safe empty values instead of throwing', async () => {
    AuditLog.create.mockResolvedValue({});

    await recordAuditEvent({ action: 'system.event' });

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, tenantId: null, ipAddress: '', userAgent: '', metadata: {} })
    );
  });

  it('swallows a DB write failure instead of throwing (fire-and-forget)', async () => {
    AuditLog.create.mockRejectedValue(new Error('Mongo unavailable'));

    await expect(recordAuditEvent({ action: 'login', req: {} })).resolves.toBeUndefined();
  });
});
