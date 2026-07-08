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

  // Send via super admin's Baileys WhatsApp
  let sent = false;
  let error = null;
  try {
    const { sendText } = require('./baileysService');
    const label = purpose === 'SIGNUP' ? 'account signup' : 'password reset';
    await sendText({
      to: mobile,
      body: `Your Bulk Invite ${label} OTP is: *${code}*\nValid for 10 minutes. Do not share this code.`,
    });
    sent = true;
  } catch (err) {
    error = err.message;
    logger.error('[OTP] WhatsApp send error:', err.message);
  }

  const result = { sent, error };
  // In non-production, surface OTP in response for easy testing
  if (process.env.NODE_ENV !== 'production') result.devOtp = code;
  return result;
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
