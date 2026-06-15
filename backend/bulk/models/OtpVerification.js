const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  mobile:    { type: String, required: true },
  code:      { type: String, required: true },
  purpose:   { type: String, enum: ['SIGNUP', 'FORGOT_PASSWORD'], required: true },
  expiresAt: { type: Date, required: true },
  used:      { type: Boolean, default: false },
}, { timestamps: true });

otpSchema.index({ mobile: 1, purpose: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-delete after expiry

module.exports = mongoose.model('OtpVerification', otpSchema);
