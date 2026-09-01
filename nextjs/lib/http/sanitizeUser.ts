// Ported from backend/src/routes/Users.js's sanitizeUser/isAdminRole — kept
// as the legacy Metabsp API contract (User_name/User_group/Mobile_number)
// so the existing frontend doesn't need to change its response parsing.
//
// `User_name` now carries the mobile number, because that is what an account
// is identified by. The key is kept rather than renamed so that any caller
// still reading it gets the current identifier instead of a missing field.
// `Display_name` is the separate, cosmetic label.
const isAdminRole = (user: any) => Array.isArray(user?.roleId?.permissions) && user.roleId.permissions.includes('*');

export const sanitizeUser = (userDoc: any) => {
  if (!userDoc) return null;
  const mobile = userDoc.mobile || '';
  const displayName = userDoc.name && userDoc.name !== mobile ? userDoc.name : '';
  return {
    id: String(userDoc._id),
    User_name: mobile || userDoc.username,
    Display_name: displayName,
    User_group: isAdminRole(userDoc) ? 'admin' : 'user',
    Mobile_number: mobile,
    Whatsapp_provider: userDoc.whatsappProviderPreference || '',
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
};
