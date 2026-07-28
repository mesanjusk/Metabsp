import mongoose, { Schema } from 'mongoose';

// Ported from backend/src/models/ConversationOwner.js.
const conversationOwnerSchema = new Schema(
  {
    whatsappAccountId: { type: Schema.Types.ObjectId, ref: 'WhatsAppAccount', required: true },
    phone: { type: String, required: true, trim: true },
    destinationId: { type: Schema.Types.ObjectId, ref: 'WebhookDestination', required: true },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationOwnerSchema.index({ whatsappAccountId: 1, phone: 1 }, { unique: true });
(conversationOwnerSchema.statics as any).TTL_MS = 30 * 60 * 1000;

export const ConversationOwner =
  (mongoose.models.ConversationOwner as any) || mongoose.model('ConversationOwner', conversationOwnerSchema);
export default ConversationOwner;
