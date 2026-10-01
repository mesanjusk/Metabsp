import mongoose, { Schema } from 'mongoose';

const rcsConsentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    agentId: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    optedOut: { type: Boolean, default: false, index: true },
    source: { type: String, default: 'webhook', trim: true },
    lastEventAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

rcsConsentSchema.index({ userId: 1, agentId: 1, phone: 1 }, { unique: true });

export const RcsConsent =
  (mongoose.models.RcsConsent as any) || mongoose.model('RcsConsent', rcsConsentSchema);

export default RcsConsent;
