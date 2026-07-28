import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';

// Ported from backend/src/models/WebhookDestination.js.
const webhookDestinationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    whatsappAccountId: { type: Schema.Types.ObjectId, ref: 'WhatsAppAccount', required: true, index: true },
    label: { type: String, default: 'My project', trim: true },
    url: { type: String, required: true, trim: true },
    secret: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    entryKeyword: { type: String, default: '', trim: true, uppercase: true },
    aliases: { type: [String], default: [] },
    fanoutFallback: { type: Boolean, default: false },
    lastAttemptAt: { type: Date, default: null },
    lastStatus: { type: String, enum: ['', 'success', 'failed'], default: '' },
    lastError: { type: String, default: '' },
  },
  { timestamps: true }
);

webhookDestinationSchema.index({ whatsappAccountId: 1, isActive: 1 });
webhookDestinationSchema.statics.generateSecret = () => crypto.randomBytes(24).toString('hex');

export const WebhookDestination =
  (mongoose.models.WebhookDestination as any) || mongoose.model('WebhookDestination', webhookDestinationSchema);
export default WebhookDestination;
