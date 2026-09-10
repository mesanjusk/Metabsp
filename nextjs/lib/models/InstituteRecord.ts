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

export default mongoose.models.InstituteRecord || mongoose.model('InstituteRecord', InstituteRecordSchema);
