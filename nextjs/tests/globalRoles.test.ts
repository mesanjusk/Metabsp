import { describe, expect, it, vi, beforeEach } from 'vitest';

const findOneAndUpdate = vi.fn();
vi.mock('@/lib/models/Role', () => ({ default: { findOneAndUpdate: (...a: any[]) => findOneAndUpdate(...a) } }));

const { getGlobalRoles, clearRoleCache, METABSP_USER_ROLE_CODE } = await import('@/lib/auth/globalRoles');

/**
 * The role a self-service signup receives decides whether a stranger becomes a
 * customer or an operator. These cover both halves of that: the roles being
 * created at all now that the process which seeded them is gone, and the
 * default one never carrying administrator permissions.
 */
describe('global roles', () => {
  beforeEach(() => {
    clearRoleCache();
    findOneAndUpdate.mockReset();
  });

  it('creates both roles on demand rather than requiring a separate seeding process', async () => {
    findOneAndUpdate.mockImplementation(async (filter: any) => ({
      _id: filter.code,
      permissions: filter.code === METABSP_USER_ROLE_CODE ? ['dashboard:view', 'whatsapp:send'] : ['*'],
    }));

    await getGlobalRoles();

    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    for (const call of findOneAndUpdate.mock.calls) {
      expect(call[2]).toMatchObject({ upsert: true });
      // $setOnInsert, so an operator's deliberate edit is not reset on boot.
      expect(call[1]).toHaveProperty('$setOnInsert');
      expect(call[1]).not.toHaveProperty('$set');
    }
  });

  it('gives the default user role no administrator permission', async () => {
    findOneAndUpdate.mockImplementation(async (filter: any) => ({ _id: filter.code, permissions: [] }));
    await getGlobalRoles();

    const userCall = findOneAndUpdate.mock.calls.find(
      (call: any) => call[0].code === METABSP_USER_ROLE_CODE
    );
    expect(userCall?.[1].$setOnInsert.permissions).not.toContain('*');
  });

  it('refuses to hand out a default role that grants "*"', async () => {
    // If someone edits the role in the database to include '*', every new
    // signup silently becomes an administrator. Failing the signup is the
    // recoverable outcome; creating that account is not.
    findOneAndUpdate.mockImplementation(async (filter: any) => ({
      _id: filter.code,
      permissions: filter.code === METABSP_USER_ROLE_CODE ? ['*'] : ['*'],
    }));

    await expect(getGlobalRoles()).rejects.toThrow(/administrator/i);
  });

  it('caches after a successful read so signup does not re-upsert every time', async () => {
    findOneAndUpdate.mockImplementation(async (filter: any) => ({ _id: filter.code, permissions: [] }));
    await getGlobalRoles();
    await getGlobalRoles();
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
  });
});
