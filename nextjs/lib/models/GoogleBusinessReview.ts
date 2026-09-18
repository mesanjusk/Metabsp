import mongoose, { Schema } from 'mongoose';

const googleBusinessReviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    googleBusinessAccountId: { type: Schema.Types.ObjectId, ref: 'GoogleBusinessAccount', required: true, index: true },
    reviewId: { type: String, required: true, trim: true },
    reviewerName: { type: String, default: '', trim: true },
    starRating: { type: Number, min: 0, max: 5, default: 0 },
    reviewText: { type: String, default: '' },
    reviewReplyText: { type: String, default: '' },
    replyStatus: {
      type: String,
      enum: ['PENDING_APPROVAL', 'PUBLISHED', 'FAILED'],
      default: 'PENDING_APPROVAL',
      index: true,
    },
    failureReason: { type: String, default: '' },
    googleCreatedAt: { type: Date, default: null },
    googleUpdatedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    lastSyncedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

googleBusinessReviewSchema.index({ userId: 1, reviewId: 1 }, { unique: true });
googleBusinessReviewSchema.index({ tenantId: 1, replyStatus: 1, createdAt: -1 });

export const GoogleBusinessReview =
  (mongoose.models.GoogleBusinessReview as any) ||
  mongoose.model('GoogleBusinessReview', googleBusinessReviewSchema);

export default GoogleBusinessReview;
