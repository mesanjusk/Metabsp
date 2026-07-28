import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';

// SHARED model — ported from backend/bulk/models/ApiKey.js. Note userId is
// a plain String (not an ObjectId ref) in the original — preserved as-is
// per the zero-schema-change mandate even though it's an inconsistency
// flagged in docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md §1.4.
const apiKeySchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, default: 'Default', trim: true },
    isActive: { type: Boolean, default: true, index: true },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

apiKeySchema.statics.generate = function (userId: string, name = 'Default') {
  const key = 'mbsp_' + crypto.randomBytes(28).toString('hex');
  return this.create({ key, userId, name });
};

export const ApiKey = (mongoose.models.ApiKey as any) || mongoose.model('ApiKey', apiKeySchema);
export default ApiKey;
