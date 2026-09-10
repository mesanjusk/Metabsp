import mongoose, { Schema } from 'mongoose';

const instituteDesignSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    designUuid: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: 'Untitled Design', trim: true },
    docType: { type: String, enum: ['id_card', 'certificate', 'result', 'admit_card'], required: true, index: true },
    width: { type: Number, default: 324 },
    height: { type: Number, default: 204 },
    canvas: { type: Schema.Types.Mixed, default: { background: '#ffffff', elements: [] } },
    thumbnail: { type: String, default: '' },
    archived: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

instituteDesignSchema.index({ tenantId: 1, ownerUserId: 1, updatedAt: -1 });

export const InstituteDesign =
  (mongoose.models.InstituteDesign as any) || mongoose.model('InstituteDesign', instituteDesignSchema);

export default InstituteDesign;
