export const MODULE_PERMISSIONS = {
  dashboard:          'dashboard:view',
  notifications:      'notifications:view',
  admin:              'users:manage',
  whatsapp:           'whatsapp:send',
  superAdminSettings: 'super_admin:settings',
};

export const APP_ROUTES = [
  { label: 'Dashboard',       to: '/dashboard',            permission: MODULE_PERMISSIONS.dashboard },
  { label: 'WhatsApp',        to: '/whatsapp-bulk',        permission: MODULE_PERMISSIONS.whatsapp },
  { label: 'Notifications',   to: '/notifications',        permission: MODULE_PERMISSIONS.notifications },
  { label: 'Users',           to: '/users',                permission: MODULE_PERMISSIONS.admin },
  { label: 'Roles',           to: '/roles',                permission: MODULE_PERMISSIONS.admin },
  { label: 'Admin',           to: '/admin',                permission: MODULE_PERMISSIONS.admin },
  { label: 'System Settings', to: '/super-admin/settings', permission: MODULE_PERMISSIONS.superAdminSettings },
];

export function getPermissions(user) {
  return user?.roleId?.permissions || [];
}

export function canAccess(user, permission) {
  if (!permission) return true;
  const permissions = getPermissions(user);
  if (!permissions.length) return true;
  if (permissions.includes('*')) return true;
  return permissions.includes(permission);
}

export function isSuperAdmin(user) {
  return getPermissions(user).includes('*');
}
