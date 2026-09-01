import WhatsAppAccount from '../models/WhatsAppAccount';
import Message from '../models/Message';

/**
 * Messages, unlike WhatsAppAccounts, carry no tenantId of their own — usage is
 * metered by first resolving which accounts belong to a tenant, then counting
 * outbound messages against those accounts. Only OUTGOING messages count,
 * matching how Meta itself bills (business-initiated conversations), not
 * inbound customer replies.
 */
export async function getMessageUsageForTenant(
  tenantId: unknown,
  { periodStart, periodEnd }: { periodStart: Date; periodEnd: Date }
) {
  const accounts: any[] = await WhatsAppAccount.find({ tenantId }).select('_id').lean();
  const accountIds = accounts.map((account) => account._id);

  if (!accountIds.length) return { messageCount: 0, accountCount: 0 };

  // `direction` is written lowercase everywhere a message is persisted
  // (lib/whatsapp/dispatch.ts, webhookHandler.ts, coexistence.ts). The Express
  // original queried for 'OUTGOING' in caps, so this count was always zero and
  // every metered invoice billed the plan price with no overage. Matching both
  // the current lowercase value and the legacy caps one keeps historic rows
  // countable; `fromMe` is the third, oldest spelling of the same fact.
  const messageCount = await Message.countDocuments({
    whatsappAccountId: { $in: accountIds },
    $or: [{ direction: { $in: ['outgoing', 'OUTGOING'] } }, { direction: { $exists: false }, fromMe: true }],
    createdAt: { $gte: periodStart, $lt: periodEnd },
  });

  return { messageCount, accountCount: accountIds.length };
}
