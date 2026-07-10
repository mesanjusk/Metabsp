const mongoose = require('mongoose');

const orgSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  mobile:  { type: String, required: true, unique: true, trim: true },
  isActive: { type: Boolean, default: true },

  // SaaS/billing fields — additive, all default so existing Organization
  // docs (created by the Bulk product's org signup, before any of this
  // existed) keep working unchanged. This is the shared tenant/billing
  // entity for both the Bulk product and WhatsApp Cloud accounts (see
  // src/services/tenantService.js), not a separate per-product concept.
  planCode: {
    type: String,
    enum: ['trial', 'starter', 'growth', 'enterprise'],
    default: 'trial',
  },
  planStatus: {
    type: String,
    enum: ['trialing', 'active', 'past_due', 'canceled'],
    default: 'trialing',
  },
  trialEndsAt: { type: Date, default: null },
  billingEmail: { type: String, default: '', trim: true },
  // Which product first created this tenant — informational only, useful
  // once a partner/admin portal needs to filter/report by origin.
  createdVia: {
    type: String,
    enum: ['bulk_signup', 'whatsapp_cloud_signup'],
    default: 'bulk_signup',
  },

  // Gates the Baileys/WhatsApp-Web (unofficial protocol) feature set — QR
  // connect, manual-invite sending, and Baileys-based campaigns. Off by
  // default for every organization (existing and new): the feature stays
  // fully implemented in the codebase, just not reachable, until a super
  // admin explicitly turns it on for a given customer (see
  // PATCH /api/bulk/org/:id/baileys). This is a business/Meta-review
  // decision, not a code removal — see docs/meta-tech-provider/APP_REVIEW.md.
  baileysEnabled: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Organization', orgSchema);
