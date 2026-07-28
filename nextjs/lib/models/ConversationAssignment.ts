import mongoose, { Schema } from 'mongoose';

// Ported from backend/src/models/ConversationAssignment.js.
const conversationAssignmentSchema = new Schema(
  {
    whatsappAccountId: { type: Schema.Types.ObjectId, ref: 'WhatsAppAccount', required: true, index: true },
    contactPhone: { type: String, required: true, trim: true },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

conversationAssignmentSchema.index({ whatsappAccountId: 1, contactPhone: 1 }, { unique: true });

export const ConversationAssignment =
  (mongoose.models.ConversationAssignment as any) || mongoose.model('ConversationAssignment', conversationAssignmentSchema);
export default ConversationAssignment;
