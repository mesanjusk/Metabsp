const mongoose = require('mongoose');

// Defines what a tenant can be billed for — separate from Subscription
// (which tracks one tenant's actual enrollment in a plan) so plans can be
// edited/versioned without touching existing subscribers' records.
const subscriptionPlanSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    priceInPaise: { type: Number, required: true, min: 0 },
    billingInterval: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    // Included-in-plan quotas — usage above these is metered separately
    // (see usageMeteringService.js) and reflected as an overage line item
    // on the next invoice.
    includedMessages: { type: Number, default: 0, min: 0 },
    includedConversations: { type: Number, default: 0, min: 0 },
    overagePricePerMessageInPaise: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
