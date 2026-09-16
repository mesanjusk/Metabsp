import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import AppError from '@/lib/utils/AppError';
const requireAuth = vi.fn(async (_req: any): Promise<any> => ({ id: 'user1' }));
const findKeys = vi.fn();
const generateBusy = vi.fn(async (_user: string, _name: string, _config: any) => ({ doc: { _id: 'key1' }, rawKey: 'busy_new_secret' }));
const findAccounts = vi.fn();
const accountLoader = vi.fn();
const listTemplates = vi.fn(async (): Promise<any[]> => []);
vi.mock('@/lib/auth/session', () => ({ requireAuth }));
vi.mock('@/lib/models/ApiKey', () => ({ default: { find: findKeys, generateBusy } }));
vi.mock('@/lib/models/WhatsAppAccount', () => ({ default: { find: findAccounts } }));
vi.mock('@/lib/services/whatsappAccountService', () => ({ loadWhatsAppAccountForUserById: accountLoader }));
vi.mock('@/lib/whatsapp/templates', () => ({ listTemplates }));
vi.mock('@/lib/services/auditLogService', () => ({ recordAuditEvent: vi.fn() }));
const { GET, POST } = await import('@/app/api/whatsapp/busy/route');
const post = (body: any) => new NextRequest('https://example.test/api/whatsapp/busy', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue({ id: 'user1' });
  accountLoader.mockResolvedValue({ account: { _id: 'acct1' }, phoneNumberId: 'PN1', displayPhoneNumber: '919000000000' });
  findAccounts.mockReturnValue({ select: () => ({ lean: async () => [] }) });
  findKeys.mockReturnValue({ sort: () => ({ lean: async () => [{ _id: 'key1', key: 'retired', keyHash: 'hash', keyPrefix: 'busy_123', userId: 'user1', isActive: true, busyConfig: {} }] }) });
  listTemplates.mockResolvedValue([{ name: 'invoice', status: 'APPROVED', language: 'hi', components: [{ type: 'BODY', text: 'बिल {{1}}' }] }]);
});

describe('BUSY integration management', () => {
  it('lists only the signed-in user’s scoped integrations and never returns credentials', async () => {
    const res = await GET(new NextRequest('https://example.test/api/whatsapp/busy'));
    expect(res.status).toBe(200);
    expect(findKeys).toHaveBeenCalledWith({ userId: 'user1', scope: 'busy' });
    const body = await res.json();
    expect(body.integrations[0]).not.toHaveProperty('key');
    expect(body.integrations[0]).not.toHaveProperty('keyHash');
    expect(findAccounts).toHaveBeenCalledWith(expect.objectContaining({ $or: [{ userId: 'user1' }, { teamMemberIds: 'user1' }] }));
  });
  it('does not issue tokens without dashboard authentication', async () => {
    requireAuth.mockRejectedValue(new AppError('No token provided', 401));
    expect((await POST(post({ mode: 'text', accountId: 'acct1' }))).status).toBe(401);
    expect(generateBusy).not.toHaveBeenCalled();
  });
  it('refuses an account the user cannot access', async () => {
    accountLoader.mockRejectedValue(new AppError('No account access', 403));
    expect((await POST(post({ mode: 'text', accountId: 'other-account' }))).status).toBe(403);
    expect(accountLoader).toHaveBeenCalledWith('user1', 'other-account');
    expect(generateBusy).not.toHaveBeenCalled();
  });
  it('pins server-resolved sender data and ignores injected template settings in text mode', async () => {
    const res = await POST(post({ mode: 'text', accountId: 'acct1', name: 'Books', phoneNumberId: 'PN-other', bindings: [{ source: 'secret' }] }));
    expect(res.status).toBe(201);
    expect(generateBusy).toHaveBeenCalledWith('user1', 'Books', expect.objectContaining({ accountId: 'acct1', phoneNumberId: 'PN1', bindings: [] }));
  });
  it('checks template ownership and approval at creation', async () => {
    expect((await POST(post({ mode: 'template', accountId: 'acct1', template: 'unowned', language: 'hi' }))).status).toBe(400);
    listTemplates.mockResolvedValue([{ name: 'invoice', status: 'PENDING', language: 'hi' }]);
    expect((await POST(post({ mode: 'template', accountId: 'acct1', template: 'invoice', language: 'hi' }))).status).toBe(400);
    expect(generateBusy).not.toHaveBeenCalled();
  });
  it('derives template components from Meta and validates each mapping', async () => {
    const body = { mode: 'template', accountId: 'acct1', template: 'invoice', language: 'hi' };
    expect((await POST(post({ ...body, sources: { 'body:1': 'unknown' } }))).status).toBe(400);
    expect((await POST(post({ ...body, sources: { 'body:1': 'param1' }, bindings: [{ component: 'malicious' }] }))).status).toBe(201);
    expect(generateBusy).toHaveBeenLastCalledWith('user1', 'BUSY Accounting', expect.objectContaining({ template: 'invoice', language: 'hi', bindings: [
      { component: 'body', variable: '1', type: 'text', named: false, source: 'param1' },
    ] }));
  });
  it('checks access before listing templates for a selected account', async () => {
    await GET(new NextRequest('https://example.test/api/whatsapp/busy?accountId=acct1'));
    expect(accountLoader).toHaveBeenCalledWith('user1', 'acct1');
    expect(listTemplates).toHaveBeenCalledWith(expect.objectContaining({ phoneNumberId: 'PN1' }));
  });
});
