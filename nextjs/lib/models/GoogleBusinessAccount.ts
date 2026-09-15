import mongoose, { Schema } from 'mongoose';

/**
 * A connected Google Business Profile.
 *
 * Google's OAuth for the Business Profile APIs is a *refresh token* flow, not
 * the long-lived page token Meta hands out: the access token lasts an hour and
 * the refresh token is the only durable credential. It is therefore the one
 * value that must survive here, encrypted with the same key as every other
 * provider secret; the access token is cached alongside it purely to avoid a
 * token round trip on every request.
 *
 * `locationName`/`accountName` are Google resource names ("accounts/123",
 * "locations/456"), not display strings — the v4 review and post endpoints are
 * addressed as `accounts/{a}/locations/{l}`, so both halves have to be stored.
 */
const googleBusinessAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },

    // Google identity that authorised the connection, for display only.
    googleUserId: { type: String, default: '', trim: true, index: true },
    googleEmail: { type: String, default: '', trim: true },

    // Resource names.
    accountName: { type: String, default: '', trim: true },
    accountDisplayName: { type: String, default: '', trim: true },
    locationName: { type: String, default: '', trim: true, index: true },
    locationTitle: { type: String, default: '', trim: true },
    locationAddress: { type: String, default: '', trim: true },
    locationPhone: { type: String, default: '', trim: true },
    locationWebsite: { type: String, default: '', trim: true },
    mapsUri: { type: String, default: '', trim: true },
    newReviewUri: { type: String, default: '', trim: true },

    // The OAuth client this authorization was issued to.
    //
    // A Google refresh token is bound to the client that obtained it: redeeming
    // it needs the same client_id and secret, and any other pair is rejected.
    // So if an operator rotates the platform client, every connection made
    // against the old one stops refreshing about an hour later. Recording the
    // issuer is what lets that be reported as "reconnect, the platform client
    // changed" instead of an unexplained authorization failure.
    issuedByClientId: { type: String, default: '', trim: true, index: true },

    refreshTokenEncrypted: { type: String, required: true },
    accessTokenEncrypted: { type: String, default: '' },
    accessTokenExpiresAt: { type: Date, default: null },
    scopes: { type: [String], default: [] },

    status: {
      type: String,
      enum: ['active', 'disconnected', 'error', 'pending'],
      default: 'active',
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    lastError: { type: String, default: '' },
    connectedAt: { type: Date, default: Date.now },
    lastSyncAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

// One live Google Business connection per dashboard user, same shape as the
// Instagram partial index — reconnecting deactivates the previous row rather
// than accumulating duplicates.
googleBusinessAccountSchema.index(
  { userId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const GoogleBusinessAccount =
  (mongoose.models.GoogleBusinessAccount as any) ||
  mongoose.model('GoogleBusinessAccount', googleBusinessAccountSchema);

export default GoogleBusinessAccount;
