const mongoose = require('mongoose');

// One tenant's actual enrollment in a plan, plus the state of its UPI
// Autopay mandate. gatewaySubscriptionId/gatewayCustomerId are opaque
// identifiers from whichever payment gateway is configured (see
// src/services/paymentGatewayService.js) — this model itself has no
// gateway-specific fields.
const subscriptionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    status: {
      type: String,
      enum: ['pending_mandate', 'active', 'past_due', 'canceled'],
      default: 'pending_mandate',
      index: true,
    },
    gatewaySubscriptionId: { type: String, default: '', trim: true, index: true },
    gatewayCustomerId: { type: String, default: '', trim: true },
    mandateAuthorizedAt: { type: Date, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

subscriptionSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
