import mongoose, { Schema } from 'mongoose';

// Ported from backend/bulk/models/Campaign.js. Same collection.
const recipientSchema = new Schema(
  {
    name: { type: String, default: '' },
    mobile: { type: String, default: '' },
    waUrl: { type: String, default: '' },
    status: { type: String, enum: ['PENDING', 'SENT', 'FAILED'], default: 'PENDING' },
    error: { type: String, default: '' },
    sentAt: { type: Date },
  },
  { _id: false }
);

const campaignSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    title: { type: String, default: 'Untitled Campaign' },
    imageUrl: { type: String, default: '' },
    message: { type: String, default: '' },
    fontStyle: { type: Schema.Types.Mixed, default: {} },
    includeRsvp: { type: Boolean, default: false },
    rsvpYesLabel: { type: String, default: "Yes, I'll attend ✅" },
    rsvpNoLabel: { type: String, default: "Sorry, can't make it ❌" },
    recipients: [recipientSchema],
    scheduledAt: { type: Date, default: null },
    type: { type: String, enum: ['AUTO', 'MANUAL'], default: 'MANUAL' },
    status: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED'],
      default: 'DRAFT',
    },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Campaign = (mongoose.models.Campaign as any) || mongoose.model('Campaign', campaignSchema);
export default Campaign;
