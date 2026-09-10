import mongoose, { Schema } from 'mongoose';

const instituteIDCardProjectSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectUuid: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    academicYear: { type: String, default: '', trim: true },
    designId: { type: Schema.Types.ObjectId, ref: 'InstituteDesign', default: null },
    principalSignatureUrl: { type: String, default: '' },
    status: { type: String, enum: ['active', 'completed'], default: 'active', index: true },
    archived: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

instituteIDCardProjectSchema.index({ tenantId: 1, ownerUserId: 1, createdAt: -1 });

export const InstituteIDCardProject =
  (mongoose.models.InstituteIDCardProject as any) ||
  mongoose.model('InstituteIDCardProject', instituteIDCardProjectSchema);

export default InstituteIDCardProject;
