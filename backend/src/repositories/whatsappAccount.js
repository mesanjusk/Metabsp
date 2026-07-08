const mongoose = require('mongoose');

const whatsappAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Nullable/additive — the owning Organization (shared tenant model with
    // the Bulk product, see src/services/tenantService.js). Isolation is
    // still enforced by userId + the phoneNumberId uniqueness constraints
    // below; tenantId is metadata for billing/quotas/multi-seat features,
    // not (yet) a query filter, so existing accounts with tenantId: null
    // behave exactly as before.
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    accountKey: { type: String, default: '', trim: true },
    connectionMode: {
      type: String,
      enum: ['embedded_signup', 'manual', 'legacy_env'],
      default: 'manual',
      index: true,
    },
    wabaId: { type: String, default: '', trim: true, index: true },
    businessAccountId: { type: String, default: '', trim: true, index: true },
    // No field-level index here — the partial unique index below already
    // covers {phoneNumberId: 1} and Mongoose warns on the duplicate key
    // pattern if both are declared.
    phoneNumberId: { type: String, required: true, trim: true },
    displayPhoneNumber: { type: String, default: '', trim: true },
    verifiedName: { type: String, default: '', trim: true },
    accessTokenEncrypted: { type: String, required: true },
    tokenType: { type: String, default: 'Bearer', trim: true },
    tokenExpiresAt: { type: Date, default: null },
    systemUserId: { type: String, default: '', trim: true },
    appScopedMetaUserId: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['active', 'disconnected', 'error', 'pending'],
      default: 'active',
      index: true,
    },
    webhookSubscribed: { type: Boolean, default: false },
    // True while this account holds a real-world claim on `phoneNumberId` — set
    // false on disconnect/delete so the number can be reconnected (by this user
    // or another) without tripping the partial unique index below. Mongo partial
    // filter expressions only support equality, hence this flag instead of a
    // `status: { $ne: 'disconnected' }` filter.
    numberClaimed: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    connectedAt: { type: Date, default: Date.now },
    lastSyncAt: { type: Date, default: null },
    lastWebhookAt: { type: Date, default: null },
    callbackUrl: { type: String, default: '', trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Additive — lets other platform users view/reply to this account's
    // conversations (shared team inbox) without owning it. The owner
    // (userId above) is implicit and not duplicated into this list.
    teamMemberIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

whatsappAccountSchema.index({ userId: 1, phoneNumberId: 1 }, { unique: true });
whatsappAccountSchema.index({ userId: 1, isActive: 1, status: 1 });
whatsappAccountSchema.index({ userId: 1, accountKey: 1 }, { unique: true, sparse: true });
whatsappAccountSchema.index(
  { userId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);
// Global cross-user guarantee: a real WhatsApp phoneNumberId can only be
// claimed by one user's account at a time (the shared /webhook endpoint
// routes solely by this identifier, so two users holding the same one would
// make inbound routing ambiguous). See services/whatsappAccountService.js:
// assertPhoneNumberAvailable for the app-level check backing this index up.
whatsappAccountSchema.index(
  { phoneNumberId: 1 },
  { unique: true, partialFilterExpression: { numberClaimed: true } }
);

module.exports = mongoose.model('WhatsAppAccount', whatsappAccountSchema);
