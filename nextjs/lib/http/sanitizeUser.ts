// Ported from backend/src/routes/Users.js's sanitizeUser/isAdminRole — kept
// as the legacy Metabsp API contract (User_name/User_group/Mobile_number)
// so the existing frontend doesn't need to change its response parsing.
const isAdminRole = (user: any) => Array.isArray(user?.roleId?.permissions) && user.roleId.permissions.includes('*');

export const sanitizeUser = (userDoc: any) => {
  if (!userDoc) return null;
  return {
    id: String(userDoc._id),
    User_name: userDoc.username,
    User_group: isAdminRole(userDoc) ? 'admin' : 'user',
    Mobile_number: userDoc.mobile || '',
    Whatsapp_provider: userDoc.whatsappProviderPreference || '',
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
};
