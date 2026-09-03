import { describe, expect, it, vi, beforeEach } from 'vitest';

// The finding this screen exists for is a number claimed by more than one
// account row, and an account whose owning user is gone. Both are invisible
// from every per-user view, so both are computed here and asserted here.
let accountRows: any[] = [];
let userRows: any[] = [];
const deletedIds: any[] = [];

vi.mock('@/lib/models/WhatsAppAccount', () => ({
  default: {
    find: () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => accountRows }) }) }) }),
    findById: (id: string) => ({
      select: () => ({ lean: async () => accountRows.find((a) => String(a._id) === String(id)) || null }),
    }),
    deleteOne: async (filter: any) => {
      deletedIds.push(filter._id);
      return { deletedCount: 1 };
    },
  },
}));

vi.mock('@/lib/models', () => ({
  User: { find: () => ({ select: () => ({ lean: async () => userRows }) }) },
}));

vi.mock('@/lib/auth/session', () => ({
  requireAuth: async () => ({ id: 'admin-1', isAdmin: true }),
  requireAdmin: () => {},
}));
vi.mock('@/lib/services/auditLogService', () => ({ recordAuditEvent: vi.fn() }));

const { GET } = await import('@/app/api/whatsapp/admin/accounts/route');
const { DELETE } = await import('@/app/api/whatsapp/admin/accounts/[id]/route');

const PHONE = '912271725313129';
const APP_ID = '1717826239505344';
const REAL_WABA = '901077812889176';

const list = async () => (await GET(new Request('https://x.test/api/whatsapp/admin/accounts') as any)).json();

beforeEach(() => {
  deletedIds.length = 0;
  userRows = [{ _id: 'user-1', mobile: '919372333633', Display_name: 'SK' }];
  // The production shape: two rows for one number, one of them holding the
  // Meta App ID where a WABA belongs.
  accountRows = [
    { _id: 'acct-good', userId: 'user-1', phoneNumberId: PHONE, wabaId: REAL_WABA, isActive: true, status: 'active' },
    { _id: 'acct-bad', userId: 'user-gone', phoneNumberId: PHONE, wabaId: APP_ID, isActive: true, status: 'active' },
  ];
});

describe('the account-level admin listing', () => {
  it('names the number claimed by more than one account', async () => {
    const body = await list();

    expect(body.summary.duplicateNumbers).toEqual([PHONE]);
    expect(body.data.every((a: any) => a.duplicateNumber)).toBe(true);
  });

  it('flags a row whose owning user is gone, which no per-user screen can reach', async () => {
    const body = await list();

    const orphan = body.data.find((a: any) => a.id === 'acct-bad');
    expect(orphan.orphaned).toBe(true);
    expect(orphan.owner).toBeNull();
    expect(body.summary.orphaned).toBe(1);
  });

  it('names the owner when there is one', async () => {
    const body = await list();

    const owned = body.data.find((a: any) => a.id === 'acct-good');
    expect(owned.owner).toMatchObject({ mobile: '919372333633' });
    expect(owned.orphaned).toBe(false);
  });

  it('reports no duplicates when each number has one row', async () => {
    accountRows = [accountRows[0]];
    const body = await list();

    expect(body.summary.duplicateNumbers).toEqual([]);
    expect(body.data[0].duplicateNumber).toBe(false);
  });
});

describe('deleting one account by its own id', () => {
  it('removes the row regardless of who owns it', async () => {
    // Deliberately not scoped to the caller: the row worth removing belongs to
    // somebody else, or to nobody.
    const res = await DELETE(new Request('https://x.test', { method: 'DELETE' }) as any, {
      params: Promise.resolve({ id: 'acct-bad' }),
    });

    expect(res.status).toBe(200);
    expect(deletedIds).toEqual(['acct-bad']);
  });

  it('404s on an account that is not there', async () => {
    const res = await DELETE(new Request('https://x.test', { method: 'DELETE' }) as any, {
      params: Promise.resolve({ id: 'missing' }),
    });

    expect(res.status).toBe(404);
    expect(deletedIds).toHaveLength(0);
  });
});
