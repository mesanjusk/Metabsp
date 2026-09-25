import mongoose, { Schema } from 'mongoose';

const prospectLeadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    searchJobId: { type: Schema.Types.ObjectId, ref: 'LeadSearchJob', required: true, index: true },
    sourceKey: { type: String, required: true, trim: true },
    googlePlaceId: { type: String, default: '', trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    website: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    category: { type: String, default: '', trim: true, index: true },
    rating: { type: Number, default: null }, reviewCount: { type: Number, default: 0 },
    latitude: { type: Number, default: null }, longitude: { type: Number, default: null },
    instagram: { type: String, default: '' }, facebook: { type: String, default: '' }, linkedin: { type: String, default: '' },
    source: { type: String, enum: ['google_maps'], default: 'google_maps' },
    status: { type: String, enum: ['new', 'saved', 'ignored', 'converted'], default: 'new', index: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', default: null },
  },
  { timestamps: true }
);
prospectLeadSchema.index({ userId: 1, sourceKey: 1 }, { unique: true });
prospectLeadSchema.index({ userId: 1, searchJobId: 1, createdAt: -1 });
export const ProspectLead = (mongoose.models.ProspectLead as any) || mongoose.model('ProspectLead', prospectLeadSchema);
export default ProspectLead;
