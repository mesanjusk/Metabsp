import mongoose, { Schema } from 'mongoose';

const storeProductSchema = new Schema({
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'StoreCategory', default: null, index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, trim: true, lowercase: true },
  sku: { type: String, default: '', trim: true },
  shortDescription: { type: String, default: '', trim: true, maxlength: 300 },
  description: { type: String, default: '', trim: true, maxlength: 3000 },
  priceInPaise: { type: Number, required: true, min: 0 },
  salePriceInPaise: { type: Number, default: null, min: 0 },
  images: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  stock: { type: Number, default: 0, min: 0 },
  trackInventory: { type: Boolean, default: true },
  minOrderQuantity: { type: Number, default: 1, min: 1 },
  isActive: { type: Boolean, default: true, index: true },
  isFeatured: { type: Boolean, default: false, index: true },
}, { timestamps: true });

storeProductSchema.index({ ownerUserId: 1, slug: 1 }, { unique: true });
storeProductSchema.index({ ownerUserId: 1, sku: 1 }, { unique: true, sparse: true, partialFilterExpression: { sku: { $gt: '' } } });
export default (mongoose.models.StoreProduct as any) || mongoose.model('StoreProduct', storeProductSchema);
