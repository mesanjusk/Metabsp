const WhatsAppAccount = require('../repositories/whatsappAccount');
const Message = require('../repositories/Message');

// Messages, not WhatsAppAccounts, have no tenantId of their own (see
// Phase 1's tenant model) — usage is metered by first resolving which
// accounts belong to a tenant, then counting outbound messages against
// those accounts. Only OUTGOING messages count, matching how Meta itself
// bills (business-initiated conversations), not inbound customer replies.
async function getMessageUsageForTenant(tenantId, { periodStart, periodEnd }) {
  const accounts = await WhatsAppAccount.find({ tenantId }).select('_id').lean();
  const accountIds = accounts.map((a) => a._id);

  if (!accountIds.length) return { messageCount: 0, accountCount: 0 };

  const messageCount = await Message.countDocuments({
    whatsappAccountId: { $in: accountIds },
    direction: 'OUTGOING',
    createdAt: { $gte: periodStart, $lt: periodEnd },
  });

  return { messageCount, accountCount: accountIds.length };
}

module.exports = { getMessageUsageForTenant };
