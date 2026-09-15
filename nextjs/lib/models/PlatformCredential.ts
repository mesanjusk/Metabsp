import mongoose, { Schema } from 'mongoose';

/**
 * A provider credential that belongs to the platform rather than to a customer.
 *
 * The distinction matters and is easy to get wrong. `GoogleBusinessAccount`
 * holds a *merchant's* authorization — one row per dashboard user, created when
 * they press Connect. This holds the OAuth client the platform itself registered
 * with the provider: one row for the whole deployment, shared by every merchant,
 * exactly like META_APP_ID/META_APP_SECRET. A merchant must never see or set it,
 * and it must never be stored per tenant.
 *
 * It exists so an operator can rotate that client without a redeploy. The
 * environment variables remain supported and take second place: a deployment
 * that configures Google through Render alone keeps working untouched.
 */
const platformCredentialSchema = new Schema(
  {
    // One row per provider. 'google-business' today; the shape is deliberately
    // not Google-specific so the next provider does not need another model.
    provider: { type: String, required: true, trim: true, unique: true, index: true },

    // Public half of the OAuth client — it travels in every authorization URL,
    // so it is stored and returned in the clear.
    clientId: { type: String, default: '', trim: true },

    // Secret half, encrypted with the same key as every other provider secret.
    clientSecretEncrypted: { type: String, default: '' },

    // Optional override; empty means the app derives it from FRONTEND_URL.
    redirectUri: { type: String, default: '', trim: true },

    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: '', trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const PlatformCredential =
  (mongoose.models.PlatformCredential as any) ||
  mongoose.model('PlatformCredential', platformCredentialSchema);

export default PlatformCredential;
