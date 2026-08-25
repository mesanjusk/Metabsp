const OtpVerification = require('../models/OtpVerification');
const logger = require('../../src/utils/logger');

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOtp(mobile, purpose) {
  await OtpVerification.deleteMany({ mobile, purpose });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await OtpVerification.create({ mobile, code, purpose, expiresAt });

  // Delivered over the official Cloud API, using the same authentication-category
  // template as src/services/otpService.js. A first-time registrant has no open
  // 24-hour window with the business number, so a free-form text (what the
  // WhatsApp Web session used to send) is rejected by the Graph API anyway.
  let sent = false;
  let error = null;
  try {
    // Required lazily, as the previous sender was: a top-level require pulls
    // the Cloud API service (and its model/config graph) into this module at
    // load time, which left an open handle in any test that merely requires a
    // route file transitively importing this one.
    const { sendWhatsAppOtpMessage } = require('../../src/services/otpService');
    await sendWhatsAppOtpMessage(mobile, code);
    sent = true;
  } catch (err) {
    error = err?.response?.data?.error?.message || err.message;
    logger.error('[OTP] WhatsApp send error:', error);
  }

  return { sent, error };
}

async function verifyOtp(mobile, code, purpose) {
  const otp = await OtpVerification.findOne({
    mobile,
    code,
    purpose,
    used: false,
    expiresAt: { $gt: new Date() },
  });
  if (!otp) return { valid: false };
  otp.used = true;
  await otp.save();
  return { valid: true };
}

module.exports = { sendOtp, verifyOtp };
