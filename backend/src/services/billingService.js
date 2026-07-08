const Invoice = require('../models/Invoice');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { getMessageUsageForTenant } = require('./usageMeteringService');

function computeInvoiceAmounts({ plan, messageCount }) {
  const overageMessageCount = Math.max(0, messageCount - (plan.includedMessages || 0));
  const overageAmountInPaise = overageMessageCount * (plan.overagePricePerMessageInPaise || 0);
  const totalAmountInPaise = plan.priceInPaise + overageAmountInPaise;
  return { overageMessageCount, overageAmountInPaise, totalAmountInPaise };
}

async function generateInvoiceNumber() {
  // Sequential-enough for a small/medium tenant base without a dedicated
  // counter collection: date-prefixed + a count of invoices issued so far
  // today. Not safe against concurrent generation racing on the exact same
  // millisecond, which is an acceptable risk for a periodic (not
  // per-request) billing job.
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const countToday = await Invoice.countDocuments({
    invoiceNumber: { $regex: `^INV-${datePart}-` },
  });
  return `INV-${datePart}-${String(countToday + 1).padStart(4, '0')}`;
}

// Generates (but does not charge) an invoice for one tenant's billing
// period: plan base price + metered overage above the plan's included
// message quota. Charging happens separately once the invoice exists (see
// paymentGatewayService.js) — kept apart so invoice math is testable
// without touching any payment gateway.
async function generateInvoiceForPeriod({ tenantId, subscriptionId, plan, periodStart, periodEnd }) {
  const resolvedPlan = plan || (await SubscriptionPlan.findById(subscriptionId?.planId));
  if (!resolvedPlan) throw new Error('A plan is required to generate an invoice');

  const { messageCount } = await getMessageUsageForTenant(tenantId, { periodStart, periodEnd });
  const { overageMessageCount, overageAmountInPaise, totalAmountInPaise } = computeInvoiceAmounts({
    plan: resolvedPlan,
    messageCount,
  });

  const invoice = await Invoice.create({
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

  return invoice;
}

module.exports = { computeInvoiceAmounts, generateInvoiceNumber, generateInvoiceForPeriod };
