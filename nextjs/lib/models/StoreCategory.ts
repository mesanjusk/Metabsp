import mongoose, { Schema } from 'mongoose';

const storeCategorySchema = new Schema({
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, default: '', trim: true, maxlength: 500 },
  imageUrl: { type: String, default: '', trim: true },
  isActive: { type: Boolean, default: true, index: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

storeCategorySchema.index({ ownerUserId: 1, slug: 1 }, { unique: true });
export default (mongoose.models.StoreCategory as any) || mongoose.model('StoreCategory', storeCategorySchema);
