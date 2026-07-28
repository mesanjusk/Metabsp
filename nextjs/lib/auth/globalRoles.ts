import Role from '../models/Role';

// Ported from backend/bulk/seedAdmin.js's exported constants. The
// always-on host's seedAdmin() still runs at its own process boot and
// creates these two global (tenantId: null) roles — this app only ever
// reads them, it doesn't need to seed anything itself.
export const METABSP_ADMIN_ROLE_CODE = 'METABSP_ADMIN';
export const METABSP_USER_ROLE_CODE = 'METABSP_USER';

let roleCache: { adminRole: any; userRole: any } | null = null;

export async function getGlobalRoles() {
  if (roleCache) return roleCache;

  const [adminRole, userRole] = await Promise.all([
    Role.findOne({ code: METABSP_ADMIN_ROLE_CODE, tenantId: null }),
    Role.findOne({ code: METABSP_USER_ROLE_CODE, tenantId: null }),
  ]);

  if (!adminRole || !userRole) {
    throw new Error('Global Metabsp roles are not seeded yet — check the always-on host is running seedAdmin() at boot.');
  }

  roleCache = { adminRole, userRole };
  return roleCache;
}
