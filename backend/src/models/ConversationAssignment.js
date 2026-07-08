const mongoose = require('mongoose');

// One row per (account, customer phone) conversation — lets a shared team
// inbox route a conversation to a specific agent without touching the
// Contact/CRM model (which has its own, deliberately per-owner scoping).
const conversationAssignmentSchema = new mongoose.Schema(
  {
    whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppAccount', required: true, index: true },
    contactPhone: { type: String, required: true, trim: true },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

conversationAssignmentSchema.index({ whatsappAccountId: 1, contactPhone: 1 }, { unique: true });

module.exports = mongoose.model('ConversationAssignment', conversationAssignmentSchema);
