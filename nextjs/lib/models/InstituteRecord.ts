import mongoose, { Schema } from 'mongoose';

const InstituteRecordSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    entityType: { type: String, required: true, index: true },
    legacyId: { type: String, default: '', index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    archived: { type: Boolean, default: false, index: true },
    source: { type: String, default: 'metabsp' },
  },
  { timestamps: true, collection: 'institute_records' }
);

InstituteRecordSchema.index({ tenantId: 1, entityType: 1, createdAt: -1 });
InstituteRecordSchema.index({ ownerUserId: 1, entityType: 1, createdAt: -1 });
InstituteRecordSchema.index(
  { tenantId: 1, ownerUserId: 1, entityType: 1, legacyId: 1 },
  { unique: true, partialFilterExpression: { legacyId: { $type: 'string', $gt: '' } } }
);

// Mongoose's inferred union between an already-registered model and a newly
// created model produces incompatible overload signatures in strict TS. Other
// shared models in this migration are intentionally consumed dynamically, so
// expose one stable model type here rather than leaking that registration union.
const InstituteRecord: any =
  (mongoose.models.InstituteRecord as any) || mongoose.model('InstituteRecord', InstituteRecordSchema);

export default InstituteRecord;
