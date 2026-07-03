const mongoose = require('mongoose');
const crypto = require('crypto');

// Self-service, multi-destination webhook fan-out: a user can register several
// of their own project URLs against one connected WhatsApp number, and every
// inbound Meta webhook event for that number is forwarded to all active ones.
// This replaces the old admin-only, one-destination-per-number RoutingConfig.
const webhookDestinationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppAccount', required: true, index: true },
    label: { type: String, default: 'My project', trim: true },
    url: { type: String, required: true, trim: true },
    secret: { type: String, required: true }, // HMAC key so the destination can verify authenticity independent of Meta's app secret
    isActive: { type: Boolean, default: true },
    lastAttemptAt: { type: Date, default: null },
    lastStatus: { type: String, enum: ['', 'success', 'failed'], default: '' },
    lastError: { type: String, default: '' },
  },
  { timestamps: true }
);

webhookDestinationSchema.index({ whatsappAccountId: 1, isActive: 1 });

webhookDestinationSchema.statics.generateSecret = () => crypto.randomBytes(24).toString('hex');

module.exports = mongoose.model('WebhookDestination', webhookDestinationSchema);
