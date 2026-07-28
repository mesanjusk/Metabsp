import mongoose, { Schema } from 'mongoose';

// Ported from backend/src/models/OtpVerification.js — registered as
// CloudOtpVerification (not OtpVerification) to avoid a model-name clash
// with the Bulk product's own OtpVerification on the shared connection,
// exactly as the original file does.
const otpVerificationSchema = new Schema(
  {
    mobile: { type: String, required: true, index: true },
    code: { type: String, required: true },
    purpose: { type: String, enum: ['SIGNUP', 'RESET'], required: true },
    used: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const CloudOtpVerification =
  (mongoose.models.CloudOtpVerification as any) || mongoose.model('CloudOtpVerification', otpVerificationSchema);
export default CloudOtpVerification;
