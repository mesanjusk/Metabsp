const mongoose = require('mongoose');

// Tracks which destination currently owns a sender's conversation on a shared
// WhatsApp number, so inbound messages that don't start with any entry
// keyword are routed to the sibling project the sender is already talking to
// instead of being fanned out to everyone. Ownership expires after 30 minutes
// of inactivity and is released on EXIT.
const conversationOwnerSchema = new mongoose.Schema(
  {
    whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppAccount', required: true },
    phone: { type: String, required: true, trim: true },
    destinationId: { type: mongoose.Schema.Types.ObjectId, ref: 'WebhookDestination', required: true },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationOwnerSchema.index({ whatsappAccountId: 1, phone: 1 }, { unique: true });

conversationOwnerSchema.statics.TTL_MS = 30 * 60 * 1000;

module.exports = mongoose.model('ConversationOwner', conversationOwnerSchema);
