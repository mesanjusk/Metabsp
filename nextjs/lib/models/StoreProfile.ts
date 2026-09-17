import mongoose, { Schema } from 'mongoose';

const storeProfileSchema = new Schema({
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  tagline: { type: String, default: '', trim: true, maxlength: 180 },
  description: { type: String, default: '', trim: true, maxlength: 1200 },
  logoUrl: { type: String, default: '', trim: true },
  heroImageUrl: { type: String, default: '', trim: true },
  accentColor: { type: String, default: '#5b4bdb', trim: true },
  whatsapp: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true, maxlength: 500 },
  currency: { type: String, enum: ['INR', 'USD', 'GBP', 'EUR', 'AED'], default: 'INR' },
  isPublished: { type: Boolean, default: false, index: true },
  customDomain: { type: String, default: undefined, trim: true, lowercase: true },
  domainVerificationToken: { type: String, default: '', select: false },
  domainStatus: { type: String, enum: ['none', 'pending', 'dns_verified', 'active', 'error'], default: 'none', index: true },
  domainError: { type: String, default: '', maxlength: 500 },
  domainVerifiedAt: { type: Date, default: null },
}, { timestamps: true });

storeProfileSchema.index({ customDomain: 1 }, { unique: true, sparse: true });

export default (mongoose.models.StoreProfile as any) || mongoose.model('StoreProfile', storeProfileSchema);
