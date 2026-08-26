// Ported from backend/src/services/adminAnalyticsService.js.

import Organization from '@/lib/models/Organization';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import Message from '@/lib/models/Message';
import Subscription from '@/lib/models/Subscription';
import Invoice from '@/lib/models/Invoice';

// Cross-tenant analytics for the admin/partner view — nothing here existed
// before (the previous "admin" surfaces manage users/roles/webhook config,
// not usage or revenue). Deliberately additive rather than folded into the
// existing fragmented admin pages, so it doesn't risk breaking whatever
// those already do.
export async function getAdminOverview(
  { periodStart, periodEnd }: { periodStart?: Date; periodEnd?: Date } = {}
) {
  const now = new Date();
  const start = periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
  const end = periodEnd || now;

  const [
    tenantCount,
    activeSubscriptionCount,
    revenuePaidAgg,
    accountsByTenant,
  ] = await Promise.all([
    Organization.countDocuments({}),
    Subscription.countDocuments({ status: 'active' }),
    Invoice.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$totalAmountInPaise' } } },
    ]),
    WhatsAppAccount.aggregate([
      { $match: { tenantId: { $ne: null } } },
      { $group: { _id: '$tenantId', accountIds: { $push: '$_id' } } },
    ]),
  ]);

  const revenueInPaiseThisPeriod = revenuePaidAgg[0]?.total || 0;

  const usageByTenant = await Promise.all(
    accountsByTenant.map(async (group) => {
      const messageCount = await Message.countDocuments({
        whatsappAccountId: { $in: group.accountIds },
        direction: 'OUTGOING',
        createdAt: { $gte: start, $lte: end },
      });
      return { tenantId: group._id, messageCount };
    })
  );

  const tenantIds = usageByTenant.map((u) => u.tenantId);
  const organizations = await Organization.find({ _id: { $in: tenantIds } }).select('name planCode').lean();
  const orgById = new Map<string, any>(organizations.map((org) => [String(org._id), org]));

  const topTenantsByUsage = usageByTenant
    .map((usage) => ({
      tenantId: usage.tenantId,
      tenantName: orgById.get(String(usage.tenantId))?.name || 'Unknown',
      messageCount: usage.messageCount,
    }))
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 10);

  const totalMessagesThisPeriod = usageByTenant.reduce((sum, u) => sum + u.messageCount, 0);

  return {
    periodStart: start,
    periodEnd: end,
    tenantCount,
    activeSubscriptionCount,
    revenueInPaiseThisPeriod,
    totalMessagesThisPeriod,
    topTenantsByUsage,
  };
}

