import mongoose, { Schema } from 'mongoose';

/**
 * A record of a deletion request and what it removed.
 *
 * Meta's data-deletion callback contract requires the response to carry a
 * confirmation code that the person can look up afterwards, so there has to
 * be something durable to look it up in. It also gives an auditable answer to
 * the question the Data Use Checkup asks — "show that you honour deletion
 * requests" — which an unlogged `deleteMany` cannot.
 *
 * The row deliberately holds no message content. Provider callbacks retain
 * only the provider id plus deletion counts. Manual requests temporarily keep
 * the requester's email/account reference and reason so an administrator can
 * verify identity and process the request; they do not copy customer message
 * content into the deletion audit trail.
 */
const dataDeletionRequestSchema = new Schema(
  {
    confirmationCode: { type: String, required: true, unique: true, index: true },
    // Provider callbacks use facebook/google/instagram; manual requests use "manual".
    provider: { type: String, default: 'facebook', trim: true },
    providerUserId: { type: String, default: '', trim: true, index: true },
    // Null when the callback names a person who has no account here — which is
    // a normal outcome, not an error, and still gets a confirmation code.
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'no_account_found', 'failed'],
      default: 'completed',
      index: true,
    },
    requestType: { type: String, enum: ['provider_callback', 'manual'], default: 'provider_callback', index: true },
    requesterEmail: { type: String, default: '', trim: true, lowercase: true, index: true },
    accountId: { type: String, default: '', trim: true },
    reason: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    deletedCounts: { type: Schema.Types.Mixed, default: {} },
    error: { type: String, default: '' },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const DataDeletionRequest =
  (mongoose.models.DataDeletionRequest as any) ||
  mongoose.model('DataDeletionRequest', dataDeletionRequestSchema);

export default DataDeletionRequest;
