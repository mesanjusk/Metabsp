import mongoose, { Schema } from 'mongoose';

// Ported from backend/src/models/Subscription.js.
const subscriptionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    status: { type: String, enum: ['pending_mandate', 'active', 'past_due', 'canceled'], default: 'pending_mandate', index: true },
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

export const Subscription = (mongoose.models.Subscription as any) || mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
