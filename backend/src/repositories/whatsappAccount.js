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
    // 'coexistence' is Meta's WhatsApp Business app + Cloud API dual-mode:
    // the customer keeps using the WhatsApp Business app on their phone while
    // this platform sends/receives on the same number via Cloud API. It is
    // onboarded through the same Embedded Signup popup, but with
    // extras.featureType = 'whatsapp_business_app_onboarding' (see
    // docs/meta-tech-provider/COEXISTENCE.md), and it behaves differently at
    // runtime: messages the customer sends from the app arrive as
    // `smb_message_echoes` webhooks rather than as our own outbound sends.
    connectionMode: {
      type: String,
      enum: ['embedded_signup', 'coexistence', 'manual', 'legacy_env'],
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
    // Meta's own guidance for BSPs: prefer a Business-owned System User
    // token (generated manually in Meta Business Manager, typically set to
    // never expire) over a token tied to an individual admin's personal
    // login. tokenSource is additive/backward-compatible — every existing
    // account defaults to 'user_token' (today's only path) and behaves
    // identically; tokenRefreshService.js skips 'system_user' accounts
    // since Meta's System User tokens aren't refreshed the same way.
    tokenSource: {
      type: String,
      enum: ['user_token', 'system_user'],
      default: 'user_token',
    },
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
    // Coexistence runtime state. Additive and defaulted, so every existing
    // (non-coexistence) account keeps behaving exactly as before — `enabled`
    // stays false and nothing below is ever read.
    coexistence: {
      enabled: { type: Boolean, default: false },
      // Meta's `platform_type` on the business phone number, when the Graph
      // API returns it (e.g. 'SMB_APP' for a number still live on the
      // WhatsApp Business app). Informational only.
      platformType: { type: String, default: '', trim: true },
      // `history` webhook progress. Meta streams up to 6 months of the
      // customer's existing chats in chunks after onboarding.
      historySyncStatus: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'error'],
        default: 'not_started',
      },
      historySyncProgress: { type: Number, default: 0 },
      historyChunksReceived: { type: Number, default: 0 },
      historyMessagesImported: { type: Number, default: 0 },
      lastHistorySyncAt: { type: Date, default: null },
      // `smb_app_state_sync` webhook — contacts added/updated in the app.
      contactsSynced: { type: Number, default: 0 },
      lastStateSyncAt: { type: Date, default: null },
      // `smb_message_echoes` webhook — messages the customer sent from the
      // WhatsApp Business app or a linked device.
      lastEchoAt: { type: Date, default: null },
    },
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
