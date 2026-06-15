const User = require('./models/User');
const Role = require('./models/Role');

async function seedAdmin() {
  // ── Super Admin role (global, tenantId = null) ────────────────────────────
  const superAdminRole = await Role.findOneAndUpdate(
    { code: 'SUPER_ADMIN', tenantId: null },
    { name: 'Super Admin', code: 'SUPER_ADMIN', permissions: ['*'], tenantId: null, dashboardKey: 'super_admin' },
    { new: true, upsert: true }
  );
  console.log('✅ Super Admin role ready');

  // ── Super Admin user ──────────────────────────────────────────────────────
  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'superadmin123';

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
    console.log(`✅ Super Admin user created (username: ${superAdminUsername})`);
  } else {
    console.log('ℹ️  Super Admin already exists');
  }
}

module.exports = seedAdmin;
