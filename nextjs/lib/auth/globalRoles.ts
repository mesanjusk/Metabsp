import Role from '../models/Role';
import logger from '../utils/logger';

/**
 * The two global (tenantId: null) roles every account is assigned one of.
 *
 * These used to be created by seedAdmin() on the Express host at its own boot,
 * and this module only read them — throwing if they were missing. That host is
 * gone, so nothing was creating them any more: signup on a fresh database
 * would have failed with "Global Metabsp roles are not seeded yet", pointing at
 * a process that no longer exists.
 *
 * They are upserted here instead, on first use. Seeding on demand rather than
 * at boot means it cannot be missed by a replica that starts in an unusual
 * order, and an upsert is idempotent so concurrent callers are harmless.
 */
export const METABSP_ADMIN_ROLE_CODE = 'METABSP_ADMIN';
export const METABSP_USER_ROLE_CODE = 'METABSP_USER';

/**
 * What an ordinary account can do. Deliberately explicit and deliberately
 * short: this is the role every self-service signup receives, so anything
 * added here is granted to everyone who creates an account.
 *
 * `'*'` means administrator. It must never appear in this list — that single
 * character is the whole difference between a customer and an operator.
 */
const USER_PERMISSIONS = ['dashboard:view', 'whatsapp:send'];

let roleCache: { adminRole: any; userRole: any } | null = null;

export async function getGlobalRoles() {
  if (roleCache) return roleCache;

  const [adminRole, userRole] = await Promise.all([
    Role.findOneAndUpdate(
      { code: METABSP_ADMIN_ROLE_CODE, tenantId: null },
      {
        $setOnInsert: {
          name: 'Admin',
          code: METABSP_ADMIN_ROLE_CODE,
          permissions: ['*'],
          tenantId: null,
          dashboardKey: 'admin',
        },
      },
      { upsert: true, new: true }
    ),
    // $setOnInsert, not $set: an operator who has deliberately adjusted what
    // the default role can do should not have it silently reset on every boot.
    Role.findOneAndUpdate(
      { code: METABSP_USER_ROLE_CODE, tenantId: null },
      {
        $setOnInsert: {
          name: 'User',
          code: METABSP_USER_ROLE_CODE,
          permissions: USER_PERMISSIONS,
          tenantId: null,
          dashboardKey: 'default',
        },
      },
      { upsert: true, new: true }
    ),
  ]);

  // A default role carrying '*' would make every self-service signup an
  // administrator. Refuse rather than hand out the role: a signup that fails
  // loudly is recoverable, an account silently created with full platform
  // access is not.
  if (Array.isArray(userRole?.permissions) && userRole.permissions.includes('*')) {
    logger.error(
      `[roles] The ${METABSP_USER_ROLE_CODE} role grants '*' (full administrator). ` +
        'Every new signup would become an administrator. Remove it from that role in the database.'
    );
    throw new Error('The default user role grants administrator permissions and cannot be assigned.');
  }

  roleCache = { adminRole, userRole };
  return roleCache;
}

// Exported for tests and for anything that needs to force a re-read after
// changing a role in the database.
export function clearRoleCache() {
  roleCache = null;
}
