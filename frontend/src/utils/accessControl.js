export const MODULE_PERMISSIONS = {
  dashboard:          'dashboard:view',
  categories:         'categories:manage',
  notifications:      'notifications:view',
  admin:              'users:manage',
  whatsapp:           'whatsapp:send',
  superAdminSettings: 'super_admin:settings',
  templateConfig:     'super_admin:settings',
};

export const APP_ROUTES = [
  { label: 'Dashboard',       to: '/',                     permission: MODULE_PERMISSIONS.dashboard },
  { label: 'Categories',      to: '/categories',           permission: MODULE_PERMISSIONS.categories },
  { label: 'Notifications',   to: '/notifications',        permission: MODULE_PERMISSIONS.notifications },
  { label: 'WhatsApp',        to: '/whatsapp',             permission: MODULE_PERMISSIONS.whatsapp },
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
