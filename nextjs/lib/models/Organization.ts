import mongoose, { Schema } from 'mongoose';

// SHARED model — ported from backend/bulk/models/Organization.js.
const orgSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
    planCode: { type: String, enum: ['trial', 'starter', 'growth', 'enterprise'], default: 'trial' },
    planStatus: { type: String, enum: ['trialing', 'active', 'past_due', 'canceled'], default: 'trialing' },
    trialEndsAt: { type: Date, default: null },
    billingEmail: { type: String, default: '', trim: true },
    createdVia: { type: String, enum: ['bulk_signup', 'whatsapp_cloud_signup'], default: 'bulk_signup' },
    baileysEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Organization = (mongoose.models.Organization as any) || mongoose.model('Organization', orgSchema);
export default Organization;
