import { describe, expect, it, vi, beforeEach } from 'vitest';

// Deleting a user takes their WhatsApp account with it, and that is the point:
// an orphaned account row keeps competing to answer for a phone number long
// after the person it belonged to is gone. A duplicate row left behind by an
// earlier edit is exactly what kept a corrected WABA id from taking effect.
const deletedAccountFilters: any[] = [];
const deletedApiKeyFilters: any[] = [];
const membershipUpdates: any[] = [];
const assignmentUpdates: any[] = [];
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
    updateMany: async (filter: any, update: any) => {
      membershipUpdates.push({ filter, update });
      return { modifiedCount: 1 };
    },
  },
}));

vi.mock('@/lib/models/ApiKey', () => ({
  default: {
    deleteMany: async (filter: any) => {
      deletedApiKeyFilters.push(filter);
      return { deletedCount: 2 };
    },
  },
}));

vi.mock('@/lib/models/ConversationAssignment', () => ({
  default: {
    updateMany: async (filter: any, update: any) => {
      assignmentUpdates.push({ filter, update });
      return { modifiedCount: 3 };
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
  deletedApiKeyFilters.length = 0;
  membershipUpdates.length = 0;
  assignmentUpdates.length = 0;
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

  it('revokes their API keys, because a key authenticates against itself', async () => {
    // Not a tidiness concern: requireApiKey resolves the key record first, and
    // shared accounts are reached through teamMemberIds — a surviving key on a
    // deleted user can keep sending on somebody else's connected number.
    const res = await del('user-2');

    expect(await res.json()).toMatchObject({ apiKeysRevoked: 2 });
    expect(deletedApiKeyFilters).toEqual([{ userId: 'user-2' }]);
  });

  it('removes them from accounts they were only a team member of', async () => {
    await del('user-2');

    expect(membershipUpdates).toEqual([
      { filter: { teamMemberIds: 'user-2' }, update: { $pull: { teamMemberIds: 'user-2' } } },
    ]);
  });

  it('clears conversations assigned to them rather than stranding the threads', async () => {
    // The inbox reads any non-null assignee as "assigned", so these threads
    // would stop appearing under unassigned with nobody left to work them.
    await del('user-2');

    expect(assignmentUpdates).toEqual([
      { filter: { assignedToUserId: 'user-2' }, update: { $set: { assignedToUserId: null } } },
    ]);
  });

  it('refuses to delete the account the admin is signed in with', async () => {
    // The panel is the only place these accounts can be managed, so this would
    // lock everyone out of it with no way back in.
    authed = { id: 'user-2', isAdmin: true };

    const res = await del('user-2');

    expect(res.status).toBe(400);
    expect(deletedUserFilters).toHaveLength(0);
    expect(deletedAccountFilters).toHaveLength(0);
    expect(deletedApiKeyFilters).toHaveLength(0);
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
