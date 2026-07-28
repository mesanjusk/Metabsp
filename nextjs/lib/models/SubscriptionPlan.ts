import mongoose, { Schema } from 'mongoose';

// Ported from backend/src/models/SubscriptionPlan.js.
const subscriptionPlanSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    priceInPaise: { type: Number, required: true, min: 0 },
    billingInterval: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    includedMessages: { type: Number, default: 0, min: 0 },
    includedConversations: { type: Number, default: 0, min: 0 },
    overagePricePerMessageInPaise: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const SubscriptionPlan = (mongoose.models.SubscriptionPlan as any) || mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
export default SubscriptionPlan;
