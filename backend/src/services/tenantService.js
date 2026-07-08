const Organization = require('../../bulk/models/Organization');
const User = require('../../bulk/models/User');
const logger = require('../utils/logger');

// Every WhatsApp Cloud user becomes the owner of their own Organization the
// first time they connect a WhatsApp number. This reuses the same
// Organization model the Bulk product already uses for its multi-tenant
// Role/User scoping, so both products share one tenant/billing entity
// instead of each growing its own.
//
// IMPORTANT: this deliberately never writes to User.tenantId for Cloud
// users. routes/Users.js hardcodes `tenantId: null` as the identity of the
// entire Cloud user namespace across login, signup-uniqueness, and admin
// listing (10+ call sites) — setting a real tenantId on a Cloud user's User
// doc would make every one of those lookups stop finding them, i.e. silently
// lock them out of their own account. The tenant link lives solely on
// WhatsAppAccount.tenantId instead; Organization lookup-by-mobile is cheap
// and idempotent, so there's no need for a back-reference on User.
async function ensureTenantForUser(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error(`User ${userId} not found while provisioning a tenant`);

  const mobile = String(user.mobile || '').trim();
  let org = mobile ? await Organization.findOne({ mobile }) : null;

  if (!org) {
    try {
      org = await Organization.create({
        name: user.name || user.username || 'My Business',
        // Organization.mobile is required+unique with no other guaranteed-
        // unique field on it; fall back to a synthetic placeholder (never a
        // real phone number) only for the rare Cloud user with no mobile on
        // file, so tenant creation can't fail for that reason.
        mobile: mobile || `cloud-user-${user._id}`,
        createdVia: 'whatsapp_cloud_signup',
      });
      logger.info(`[tenant] Provisioned Organization ${org._id} for WhatsApp Cloud user ${userId}`);
    } catch (error) {
      if (error?.code === 11000) {
        org = await Organization.findOne({ mobile });
        if (!org) throw error;
      } else {
        throw error;
      }
    }
  }

  return org._id;
}

module.exports = { ensureTenantForUser };
