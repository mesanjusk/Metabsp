import Invoice from '../models/Invoice';
import SubscriptionPlan from '../models/SubscriptionPlan';
import { getMessageUsageForTenant } from './usageMeteringService';

export function computeInvoiceAmounts({ plan, messageCount }: { plan: any; messageCount: number }) {
  const overageMessageCount = Math.max(0, messageCount - (plan.includedMessages || 0));
  const overageAmountInPaise = overageMessageCount * (plan.overagePricePerMessageInPaise || 0);
  const totalAmountInPaise = plan.priceInPaise + overageAmountInPaise;
  return { overageMessageCount, overageAmountInPaise, totalAmountInPaise };
}

export async function generateInvoiceNumber(): Promise<string> {
  // Sequential-enough for a small/medium tenant base without a dedicated
  // counter collection: date-prefixed plus a count of invoices issued so far
  // today. Not safe against concurrent generation racing on the same
  // millisecond, which is acceptable for a periodic (not per-request) job
  // that additionally runs under a leader lock.
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const countToday = await Invoice.countDocuments({
    invoiceNumber: { $regex: `^INV-${datePart}-` },
  });
  return `INV-${datePart}-${String(countToday + 1).padStart(4, '0')}`;
}

/**
 * Generates (but does not charge) an invoice for one tenant's billing period:
 * plan base price plus metered overage above the plan's included quota.
 * Charging happens separately once the invoice exists, kept apart so the
 * invoice maths is testable without touching any payment gateway.
 */
export async function generateInvoiceForPeriod({
  tenantId,
  subscriptionId,
  plan,
  periodStart,
  periodEnd,
}: {
  tenantId: unknown;
  subscriptionId: any;
  plan?: any;
  periodStart: Date;
  periodEnd: Date;
}) {
  const resolvedPlan = plan || (await SubscriptionPlan.findById(subscriptionId?.planId));
  if (!resolvedPlan) throw new Error('A plan is required to generate an invoice');

  const { messageCount } = await getMessageUsageForTenant(tenantId, { periodStart, periodEnd });
  const { overageMessageCount, overageAmountInPaise, totalAmountInPaise } = computeInvoiceAmounts({
    plan: resolvedPlan,
    messageCount,
  });

  return Invoice.create({
    tenantId,
    subscriptionId: subscriptionId?._id || subscriptionId || null,
    invoiceNumber: await generateInvoiceNumber(),
    periodStart,
    periodEnd,
    planAmountInPaise: resolvedPlan.priceInPaise,
    overageMessageCount,
    overageAmountInPaise,
    totalAmountInPaise,
    status: 'pending',
  });
}
