const User = require('./models/User');
const Role = require('./models/Role');
const { PERMISSIONS } = require('./utils/permissions');
const logger = require('../src/utils/logger');

// Global (tenantId: null) roles used by the former "Metabsp" WhatsApp-BSP
// product, which has no organization/tenant concept of its own.
const METABSP_ADMIN_ROLE_CODE = 'METABSP_ADMIN';
const METABSP_USER_ROLE_CODE = 'METABSP_USER';

async function seedGlobalRoles() {
  await Role.findOneAndUpdate(
    { code: METABSP_ADMIN_ROLE_CODE, tenantId: null },
    { name: 'Admin', code: METABSP_ADMIN_ROLE_CODE, permissions: ['*'], tenantId: null, dashboardKey: 'admin' },
    { upsert: true }
  );
  await Role.findOneAndUpdate(
    { code: METABSP_USER_ROLE_CODE, tenantId: null },
    { name: 'User', code: METABSP_USER_ROLE_CODE, permissions: [PERMISSIONS.dashboard_view, PERMISSIONS.whatsapp_send], tenantId: null, dashboardKey: 'default' },
    { upsert: true }
  );
}

async function seedAdmin() {
  await seedGlobalRoles();

  // ── Super Admin role (global, tenantId = null) ────────────────────────────
  const superAdminRole = await Role.findOneAndUpdate(
    { code: 'SUPER_ADMIN', tenantId: null },
    { name: 'Super Admin', code: 'SUPER_ADMIN', permissions: ['*'], tenantId: null, dashboardKey: 'super_admin' },
    { new: true, upsert: true }
  );
  logger.info('✅ Super Admin role ready');

  // ── Super Admin user — only seeded when explicitly configured. No hardcoded
  // default credentials: an unset SUPER_ADMIN_PASSWORD means "don't seed one",
  // not "use a known password".
  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superAdminUsername || !superAdminPassword) {
    logger.warn('⚠️  SUPER_ADMIN_USERNAME/SUPER_ADMIN_PASSWORD not set — skipping super admin seed. Set both env vars to create one.');
    return;
  }

  const superAdminExists = await User.findOne({ username: superAdminUsername, tenantId: null });
  if (!superAdminExists) {
    await User.create({
      name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
      username: superAdminUsername,
      password: superAdminPassword,
      mobile: process.env.SUPER_ADMIN_MOBILE || '',
      roleId: superAdminRole._id,
      tenantId: null,
      eventDutyType: 'SUPER_ADMIN',
      isActive: true,
    });
    logger.info(`✅ Super Admin user created (username: ${superAdminUsername})`);
  } else {
    logger.info('ℹ️  Super Admin already exists');
  }
}

module.exports = seedAdmin;
module.exports.METABSP_ADMIN_ROLE_CODE = METABSP_ADMIN_ROLE_CODE;
module.exports.METABSP_USER_ROLE_CODE = METABSP_USER_ROLE_CODE;
