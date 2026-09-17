import mongoose, { Schema } from 'mongoose';
import { BUSINESS_TYPES } from '@/lib/smb/businessProfiles';

const businessProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    businessType: { type: String, enum: BUSINESS_TYPES.map((item) => item.value), required: true },
    businessName: { type: String, default: '', trim: true, maxlength: 120 },
    teamSize: { type: String, enum: ['solo', '2-5', '6-20', '21-50', '50+'], default: 'solo' },
    selectedServices: [{ type: String, trim: true }],
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const BusinessProfile =
  (mongoose.models.BusinessProfile as any) || mongoose.model('BusinessProfile', businessProfileSchema);
export default BusinessProfile;
