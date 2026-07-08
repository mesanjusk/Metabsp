const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const { ensureTenantForUser } = require('../services/tenantService');
const { renderInvoicePdf } = require('../services/invoicePdfService');
const {
  createUpiAutopaySubscription,
  verifyWebhookSignature,
  classifyWebhookEvent,
} = require('../services/paymentGatewayService');
const { recordAuditEvent } = require('../services/auditLogService');
const { getAdminOverview } = require('../services/adminAnalyticsService');
const Organization = require('../../bulk/models/Organization');

const router = express.Router();

router.get('/admin/overview', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { periodStart, periodEnd } = req.query || {};
  const overview = await getAdminOverview({
    periodStart: periodStart ? new Date(periodStart) : undefined,
    periodEnd: periodEnd ? new Date(periodEnd) : undefined,
  });
  res.json({ success: true, data: overview });
}));

router.get('/plans', requireAuth, asyncHandler(async (_req, res) => {
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({ priceInPaise: 1 }).lean();
  res.json({ success: true, data: plans });
}));

router.get('/subscription', requireAuth, asyncHandler(async (req, res) => {
  const tenantId = await ensureTenantForUser(req.user.id);
  const subscription = await Subscription.findOne({ tenantId, status: { $ne: 'canceled' } })
    .sort({ createdAt: -1 })
    .populate('planId')
    .lean();
  res.json({ success: true, data: subscription || null });
}));

router.post('/subscribe', requireAuth, asyncHandler(async (req, res) => {
  const { planId } = req.body || {};
  const plan = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
  if (!plan) throw new AppError('Plan not found', 404);

  const tenantId = await ensureTenantForUser(req.user.id);

  const subscription = await Subscription.create({
    tenantId,
    planId: plan._id,
    status: 'pending_mandate',
  });

  const gatewaySubscriptionId = `sub_${subscription._id}`;
  const { authorizationLink } = await createUpiAutopaySubscription({
    gatewaySubscriptionId,
    planName: plan.name,
    authAmountInPaise: Math.min(plan.priceInPaise, 100), // Autopay authorizes a small token amount, not the full recurring charge
    recurringAmountInPaise: plan.priceInPaise,
    customerName: req.user.name || req.user.username || 'Customer',
    customerEmail: req.user.email || '',
    customerPhone: req.user.mobile || '',
    returnUrl: `${process.env.FRONTEND_URL || ''}/billing/mandate-callback`,
  });

  subscription.gatewaySubscriptionId = gatewaySubscriptionId;
  await subscription.save();

  recordAuditEvent({ req, action: 'subscription.create', resource: 'subscription', resourceId: subscription._id, metadata: { planId: plan._id } });

  res.status(201).json({ success: true, data: { subscriptionId: subscription._id, authorizationLink } });
}));

router.get('/invoices', requireAuth, asyncHandler(async (req, res) => {
  const tenantId = await ensureTenantForUser(req.user.id);
  const invoices = await Invoice.find({ tenantId }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: invoices });
}));

router.get('/invoices/:id/pdf', requireAuth, asyncHandler(async (req, res) => {
  const tenantId = await ensureTenantForUser(req.user.id);
  const invoice = await Invoice.findOne({ _id: req.params.id, tenantId }).lean();
  if (!invoice) throw new AppError('Invoice not found', 404);

  const organization = await Organization.findById(tenantId).lean();

  const pdfBuffer = await renderInvoicePdf({ invoice, organization });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  res.send(pdfBuffer);
}));

// Cashfree webhook — no requireAuth (the gateway calls this directly), the
// HMAC signature check below is what authenticates the request instead.
router.post('/webhook', asyncHandler(async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

  if (!verifyWebhookSignature({ rawBody, signature, timestamp })) {
    logger.warn('[billing-webhook] Signature verification failed');
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  const event = classifyWebhookEvent(req.body);

  if (event.kind === 'mandate_activated' && event.gatewaySubscriptionId) {
    await Subscription.findOneAndUpdate(
      { gatewaySubscriptionId: event.gatewaySubscriptionId },
      { status: 'active', mandateAuthorizedAt: new Date() }
    );
  } else if (event.kind === 'payment_success' && event.gatewaySubscriptionId) {
    const subscription = await Subscription.findOne({ gatewaySubscriptionId: event.gatewaySubscriptionId });
    if (subscription) {
      await Invoice.findOneAndUpdate(
        { subscriptionId: subscription._id, status: 'pending' },
        { status: 'paid', gatewayPaymentId: event.gatewayPaymentId, paidAt: new Date() },
        { sort: { createdAt: -1 } }
      );
      subscription.status = 'active';
      await subscription.save();
    }
  } else if (event.kind === 'payment_failed' && event.gatewaySubscriptionId) {
    await Subscription.findOneAndUpdate(
      { gatewaySubscriptionId: event.gatewaySubscriptionId },
      { status: 'past_due' }
    );
  }

  res.status(200).json({ success: true });
}));

module.exports = router;
