import { describe, expect, it, vi, beforeEach } from 'vitest';

// Deleting a user takes their WhatsApp account with it, and that is the point:
// an orphaned account row keeps competing to answer for a phone number long
// after the person it belonged to is gone. A duplicate row left behind by an
// earlier edit is exactly what kept a corrected WABA id from taking effect.
const deletedAccountFilters: any[] = [];
const deletedUserFilters: any[] = [];
let foundUser: any = null;
let accountRows: any[] = [];

vi.mock('@/lib/models/WhatsAppAccount', () => ({
  default: {
    find: () => ({ select: () => ({ lean: async () => accountRows }) }),
    deleteMany: async (filter: any) => {
      deletedAccountFilters.push(filter);
      return { deletedCount: accountRows.length };
    },
  },
}));

vi.mock('@/lib/models', () => ({
  User: {
    findById: async () => foundUser,
    deleteOne: async (filter: any) => {
      deletedUserFilters.push(filter);
      return { deletedCount: 1 };
    },
  },
}));

let authed: any = { id: 'admin-1', isAdmin: true };
vi.mock('@/lib/auth/session', () => ({
  requireAuth: async () => authed,
  requireAdmin: () => {},
}));
vi.mock('@/lib/services/auditLogService', () => ({ recordAuditEvent: vi.fn() }));

const { DELETE } = await import('@/app/api/users/manage/[id]/route');

const del = (id: string) =>
  DELETE(new Request(`https://x.test/api/users/manage/${id}`, { method: 'DELETE' }) as any, {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  deletedAccountFilters.length = 0;
  deletedUserFilters.length = 0;
  authed = { id: 'admin-1', isAdmin: true };
  foundUser = { _id: 'user-2', mobile: '919876543210' };
  accountRows = [{ _id: 'acct-1', phoneNumberId: '912271725313129', wabaId: '1717826239505344' }];
});

describe('deleting a user', () => {
  it('removes the user and the WhatsApp rows that would outlive them', async () => {
    const res = await del('user-2');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, whatsappAccountsRemoved: 1 });
    expect(deletedAccountFilters).toEqual([{ userId: 'user-2' }]);
    expect(deletedUserFilters).toEqual([{ _id: 'user-2' }]);
  });

  it('refuses to delete the account the admin is signed in with', async () => {
    // The panel is the only place these accounts can be managed, so this would
    // lock everyone out of it with no way back in.
    authed = { id: 'user-2', isAdmin: true };

    const res = await del('user-2');

    expect(res.status).toBe(400);
    expect(deletedUserFilters).toHaveLength(0);
    expect(deletedAccountFilters).toHaveLength(0);
  });

  it('404s on a user that is not there, without deleting anything', async () => {
    foundUser = null;

    const res = await del('missing');

    expect(res.status).toBe(404);
    expect(deletedAccountFilters).toHaveLength(0);
  });

  it('handles a user who never connected a number', async () => {
    accountRows = [];

    const res = await del('user-2');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ whatsappAccountsRemoved: 0 });
  });
});
