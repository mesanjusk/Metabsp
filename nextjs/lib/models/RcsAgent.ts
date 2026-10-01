import mongoose, { Schema } from 'mongoose';

const rcsAgentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    agentId: { type: String, required: true, trim: true },
    displayName: { type: String, default: '', trim: true },
    region: { type: String, enum: ['asia', 'europe', 'us'], default: 'asia' },
    useCase: {
      type: String,
      enum: ['OTP', 'TRANSACTIONAL', 'PROMOTIONAL', 'MULTI_USE'],
      default: 'MULTI_USE',
    },
    fallbackMode: { type: String, enum: ['none', 'whatsapp', 'sms'], default: 'none' },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

rcsAgentSchema.index({ userId: 1 }, { unique: true });
rcsAgentSchema.index({ agentId: 1 }, { unique: true });

export const RcsAgent =
  (mongoose.models.RcsAgent as any) || mongoose.model('RcsAgent', rcsAgentSchema);

export default RcsAgent;
