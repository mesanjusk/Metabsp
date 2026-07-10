const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { generateInvoiceForPeriod } = require('./billingService');
const { withLeaderLock } = require('./schedulerLock');
const logger = require('../utils/logger');

// Runs daily; only actually generates an invoice for a subscription once
// its currentPeriodEnd has passed (or was never set — first billing cycle
// right after mandate activation), then rolls the period forward. Cheap
// enough to just scan all active subscriptions daily rather than needing a
// per-tenant cron schedule.
async function generateDueInvoices() {
  const now = new Date();
  const dueSubscriptions = await Subscription.find({
    status: 'active',
    $or: [{ currentPeriodEnd: null }, { currentPeriodEnd: { $lte: now } }],
  });

  let generated = 0;
  let failed = 0;

  for (const subscription of dueSubscriptions) {
    try {
      const plan = await SubscriptionPlan.findById(subscription.planId);
      if (!plan) continue;

      const periodStart = subscription.currentPeriodEnd || subscription.mandateAuthorizedAt || now;
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + (plan.billingInterval === 'yearly' ? 12 : 1));

      await generateInvoiceForPeriod({
        tenantId: subscription.tenantId,
        subscriptionId: subscription,
        plan,
        periodStart,
        periodEnd,
      });

      subscription.currentPeriodStart = periodStart;
      subscription.currentPeriodEnd = periodEnd;
      await subscription.save();
      generated += 1;
    } catch (error) {
      failed += 1;
      logger.error(`[invoice-scheduler] Failed to generate invoice for subscription ${subscription._id}:`, error.message);
    }
  }

  return { checked: dueSubscriptions.length, generated, failed };
}

// withLeaderLock ensures only one API replica generates invoices on any given
// tick — this is the highest-risk scheduler to run N-fold duplicated (see
// docs/deployment/HIGH_AVAILABILITY.md), since duplicate execution here means
// duplicate billing, not just wasted work.
function startInvoiceScheduler({ intervalMs = 24 * 60 * 60 * 1000 } = {}) {
  return setInterval(() => {
    withLeaderLock('invoice-generation', generateDueInvoices).catch((error) =>
      logger.error('[invoice-scheduler] Scheduled run failed:', error.message)
    );
  }, intervalMs).unref();
}

module.exports = { generateDueInvoices, startInvoiceScheduler };
