import Subscription from '../models/Subscription';
import SubscriptionPlan from '../models/SubscriptionPlan';
import { connectDB } from '../db/mongo';
import { generateInvoiceForPeriod } from './billingService';
import { withLeaderLock } from './schedulerLock';
import logger from '../utils/logger';

/**
 * Runs daily; only actually generates an invoice for a subscription once its
 * currentPeriodEnd has passed (or was never set — the first billing cycle
 * right after mandate activation), then rolls the period forward. Cheap
 * enough to scan all active subscriptions daily rather than needing a
 * per-tenant cron schedule.
 */
export async function generateDueInvoices() {
  await connectDB();

  const now = new Date();
  const dueSubscriptions: any[] = await Subscription.find({
    status: 'active',
    $or: [{ currentPeriodEnd: null }, { currentPeriodEnd: { $lte: now } }],
  });

  let generated = 0;
  let failed = 0;

  for (const subscription of dueSubscriptions) {
    try {
      const plan: any = await SubscriptionPlan.findById(subscription.planId);
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
    } catch (error: any) {
      failed += 1;
      logger.error(
        `[invoice-scheduler] Failed to generate invoice for subscription ${subscription._id}:`,
        error.message
      );
    }
  }

  return { checked: dueSubscriptions.length, generated, failed };
}

// withLeaderLock matters most here: duplicate execution means duplicate
// billing, not merely wasted work.
export function startInvoiceScheduler({ intervalMs = 24 * 60 * 60 * 1000 } = {}) {
  return setInterval(() => {
    withLeaderLock('invoice-generation', generateDueInvoices).catch((error) =>
      logger.error('[invoice-scheduler] Scheduled run failed:', error.message)
    );
  }, intervalMs).unref();
}
