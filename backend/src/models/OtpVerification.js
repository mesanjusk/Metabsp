const mongoose = require('mongoose');

const otpVerificationSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, index: true },
    code: { type: String, required: true },
    purpose: { type: String, enum: ['SIGNUP', 'RESET'], required: true },
    used: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CloudOtpVerification', otpVerificationSchema);
