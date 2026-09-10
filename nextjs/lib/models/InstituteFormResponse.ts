import mongoose, { Schema } from 'mongoose';

const instituteFormResponseSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  responseUuid: { type: String, required: true, unique: true, index: true },
  formId: { type: Schema.Types.ObjectId, ref: 'InstituteForm', required: true, index: true },
  formUuid: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
}, { timestamps: true });

instituteFormResponseSchema.index({ formId: 1, createdAt: -1 });
export default (mongoose.models.InstituteFormResponse as any) || mongoose.model('InstituteFormResponse', instituteFormResponseSchema);
