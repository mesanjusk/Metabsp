import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import Subscription from '@/lib/models/Subscription';
import SubscriptionPlan from '@/lib/models/SubscriptionPlan';
import { ensureTenantForUser } from '@/lib/services/tenantService';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import { createUpiAutopaySubscription, isBillingConfigured } from '@/lib/services/paymentGatewayService';

/**
 * Starts a UPI Autopay mandate for a plan.
 *
 * The dashboard's billing panel has always called this endpoint; the Next.js
 * port never had it, so the "Subscribe" button returned a 404.
 *
 * It refuses outright when the payment gateway is unconfigured rather than
 * attempting a call that would fail deeper in — see the header of
 * lib/services/paymentGatewayService.ts for why billing is off by default.
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    if (!isBillingConfigured()) {
      return NextResponse.json(
        {
          success: false,
          code: 'BILLING_NOT_ENABLED',
          message:
            'Self-service billing is not enabled on this deployment. Contact support to arrange a plan.',
        },
        { status: 503 }
      );
    }

    const { planId } = ((await req.json().catch(() => ({}))) as any) || {};
    const plan: any = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
    if (!plan) throw new AppError('Plan not found', 404);

    const tenantId = await ensureTenantForUser(authed.id);

    const subscription: any = await Subscription.create({ tenantId, planId: plan._id, status: 'pending_mandate' });
    const gatewaySubscriptionId = `sub_${subscription._id}`;

    const { authorizationLink } = await createUpiAutopaySubscription({
      gatewaySubscriptionId,
      planName: plan.name,
      // Autopay authorises a small token amount, not the full recurring charge.
      authAmountInPaise: Math.min(plan.priceInPaise, 100),
      recurringAmountInPaise: plan.priceInPaise,
      customerName: authed.doc?.name || authed.doc?.username || 'Customer',
      customerEmail: authed.doc?.email || '',
      customerPhone: authed.doc?.mobile || '',
      returnUrl: `${process.env.FRONTEND_URL || ''}/settings?billing=mandate-callback`,
    });

    subscription.gatewaySubscriptionId = gatewaySubscriptionId;
    await subscription.save();

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'subscription.create',
      resource: 'subscription',
      resourceId: subscription._id,
      metadata: { planId: plan._id },
    });

    return NextResponse.json(
      { success: true, data: { subscriptionId: subscription._id, authorizationLink } },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error, 'Failed to start the subscription');
  }
}
