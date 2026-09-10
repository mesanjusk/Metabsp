import mongoose, { Schema } from 'mongoose';

const fieldSchema = new Schema({
  fieldUuid: { type: String, required: true },
  label: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['text','email','phone','number','textarea','dropdown','radio','checkbox','date'], default: 'text' },
  options: { type: [String], default: [] },
  required: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { _id: false });

const instituteFormSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  formUuid: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  fields: { type: [fieldSchema], default: [] },
  isActive: { type: Boolean, default: true, index: true },
  successMessage: { type: String, default: 'Thank you! Your response has been recorded.' },
  createLead: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  archived: { type: Boolean, default: false, index: true },
}, { timestamps: true });

instituteFormSchema.index({ tenantId: 1, ownerUserId: 1, updatedAt: -1 });
export default (mongoose.models.InstituteForm as any) || mongoose.model('InstituteForm', instituteFormSchema);
