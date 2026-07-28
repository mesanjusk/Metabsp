import Organization from '../models/Organization';
import User from '../models/User';
import logger from '../utils/logger';

// Ported unchanged from backend/src/services/tenantService.js.
export async function ensureTenantForUser(userId: string) {
  const user: any = await User.findById(userId).lean();
  if (!user) throw new Error(`User ${userId} not found while provisioning a tenant`);

  const mobile = String(user.mobile || '').trim();
  let org: any = mobile ? await Organization.findOne({ mobile }) : null;

  if (!org) {
    try {
      org = await Organization.create({
        name: user.name || user.username || 'My Business',
        mobile: mobile || `cloud-user-${user._id}`,
        createdVia: 'whatsapp_cloud_signup',
      });
      logger.info(`[tenant] Provisioned Organization ${org._id} for WhatsApp Cloud user ${userId}`);
    } catch (error: any) {
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
