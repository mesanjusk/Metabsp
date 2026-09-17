import mongoose, { Schema } from 'mongoose';

const inquiryItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'StoreProduct', required: true },
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, min: 1, required: true },
  priceInPaise: { type: Number, min: 0, required: true },
}, { _id: false });

const storeInquirySchema = new Schema({
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  inquiryNumber: { type: String, required: true, unique: true, index: true },
  customerName: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, maxlength: 24 },
  email: { type: String, default: '', trim: true, maxlength: 160 },
  notes: { type: String, default: '', trim: true, maxlength: 1200 },
  items: { type: [inquiryItemSchema], required: true },
  totalInPaise: { type: Number, min: 0, required: true },
  status: { type: String, enum: ['new', 'contacted', 'quoted', 'confirmed', 'completed', 'cancelled'], default: 'new', index: true },
  source: { type: String, default: 'storefront' },
}, { timestamps: true });

storeInquirySchema.index({ ownerUserId: 1, createdAt: -1 });
export default (mongoose.models.StoreInquiry as any) || mongoose.model('StoreInquiry', storeInquirySchema);
