import mongoose, { Schema } from 'mongoose';

const instagramAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    instagramAppScopedId: { type: String, default: '', trim: true, index: true },
    instagramUserId: { type: String, required: true, trim: true, index: true },
    username: { type: String, default: '', trim: true },
    name: { type: String, default: '', trim: true },
    accountType: { type: String, default: '', trim: true },
    profilePictureUrl: { type: String, default: '', trim: true },
    accessTokenEncrypted: { type: String, required: true },
    tokenExpiresAt: { type: Date, default: null },
    permissions: { type: [String], default: [] },
    webhookSubscribed: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'disconnected', 'error', 'pending'],
      default: 'active',
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    connectedAt: { type: Date, default: Date.now },
    lastSyncAt: { type: Date, default: null },
    lastWebhookAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

instagramAccountSchema.index({ userId: 1, instagramUserId: 1 }, { unique: true });
instagramAccountSchema.index(
  { userId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const InstagramAccount =
  (mongoose.models.InstagramAccount as any) || mongoose.model('InstagramAccount', instagramAccountSchema);

export default InstagramAccount;
