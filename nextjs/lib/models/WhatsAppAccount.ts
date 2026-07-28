import mongoose, { Schema } from 'mongoose';

// Ported from backend/src/repositories/whatsappAccount.js — the central
// Cloud-product model. Every index below (especially the partial unique
// index on phoneNumberId) must exist identically to the always-on host's
// copy since both write to the same `whatsappaccounts` collection.
const whatsappAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    accountKey: { type: String, default: '', trim: true },
    connectionMode: {
      type: String,
      enum: ['embedded_signup', 'manual', 'legacy_env'],
      default: 'manual',
      index: true,
    },
    wabaId: { type: String, default: '', trim: true, index: true },
    businessAccountId: { type: String, default: '', trim: true, index: true },
    phoneNumberId: { type: String, required: true, trim: true },
    displayPhoneNumber: { type: String, default: '', trim: true },
    verifiedName: { type: String, default: '', trim: true },
    accessTokenEncrypted: { type: String, required: true },
    tokenType: { type: String, default: 'Bearer', trim: true },
    tokenExpiresAt: { type: Date, default: null },
    tokenSource: { type: String, enum: ['user_token', 'system_user'], default: 'user_token' },
    systemUserId: { type: String, default: '', trim: true },
    appScopedMetaUserId: { type: String, default: '', trim: true },
    status: { type: String, enum: ['active', 'disconnected', 'error', 'pending'], default: 'active', index: true },
    webhookSubscribed: { type: Boolean, default: false },
    numberClaimed: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    connectedAt: { type: Date, default: Date.now },
    lastSyncAt: { type: Date, default: null },
    lastWebhookAt: { type: Date, default: null },
    callbackUrl: { type: String, default: '', trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    teamMemberIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

whatsappAccountSchema.index({ userId: 1, phoneNumberId: 1 }, { unique: true });
whatsappAccountSchema.index({ userId: 1, isActive: 1, status: 1 });
whatsappAccountSchema.index({ userId: 1, accountKey: 1 }, { unique: true, sparse: true });
whatsappAccountSchema.index({ userId: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
whatsappAccountSchema.index({ phoneNumberId: 1 }, { unique: true, partialFilterExpression: { numberClaimed: true } });

export const WhatsAppAccount = (mongoose.models.WhatsAppAccount as any) || mongoose.model('WhatsAppAccount', whatsappAccountSchema);
export default WhatsAppAccount;
