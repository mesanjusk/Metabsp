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
 * The row deliberately holds no message content and no contact details. It
 * keeps the provider id long enough to be traceable, plus counts. Storing a
 * copy of what was deleted, inside the deletion audit trail, would defeat the
 * deletion.
 */
const dataDeletionRequestSchema = new Schema(
  {
    confirmationCode: { type: String, required: true, unique: true, index: true },
    // 'facebook' today; the shape allows another provider without a migration.
    provider: { type: String, default: 'facebook', trim: true },
    providerUserId: { type: String, default: '', trim: true, index: true },
    // Null when the callback names a person who has no account here — which is
    // a normal outcome, not an error, and still gets a confirmation code.
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    status: {
      type: String,
      enum: ['completed', 'no_account_found', 'failed'],
      default: 'completed',
      index: true,
    },
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
