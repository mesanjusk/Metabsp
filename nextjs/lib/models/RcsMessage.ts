import mongoose, { Schema } from 'mongoose';

const rcsMessageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    agentId: { type: String, required: true, trim: true, index: true },
    phone: { type: String, default: '', trim: true, index: true },
    direction: { type: String, enum: ['incoming', 'outgoing', 'event'], default: 'outgoing', index: true },
    channel: { type: String, enum: ['rcs', 'whatsapp', 'sms'], default: 'rcs', index: true },
    kind: { type: String, enum: ['message', 'event', 'fallback'], default: 'message' },
    messageId: { type: String, default: '', trim: true, index: true },
    eventId: { type: String, trim: true, index: true, sparse: true },
    eventType: { type: String, default: '', trim: true, index: true },
    text: { type: String, default: '' },
    trafficType: { type: String, default: '', trim: true },
    status: { type: String, default: 'sent', trim: true, index: true },
    raw: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

rcsMessageSchema.index({ userId: 1, createdAt: -1 });
rcsMessageSchema.index({ agentId: 1, phone: 1, createdAt: -1 });
rcsMessageSchema.index({ eventId: 1 }, { unique: true, sparse: true });

export const RcsMessage =
  (mongoose.models.RcsMessage as any) || mongoose.model('RcsMessage', rcsMessageSchema);

export default RcsMessage;
