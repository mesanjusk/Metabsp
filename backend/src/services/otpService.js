const axios = require('axios');
const OtpVerification = require('../models/OtpVerification');
const { resolveLegacyEnvConfig } = require('./whatsappAccountService');
const normalizeWhatsAppNumber = require('../utils/normalizeNumber');

const OTP_TTL_MS = 10 * 60 * 1000;

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendWhatsAppOtpMessage = async (mobile, body) => {
  const config = resolveLegacyEnvConfig();
  if (!config) {
    throw new Error('WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set to send OTP messages');
  }

  const to = normalizeWhatsAppNumber(mobile);
  const response = await axios.post(
    `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    },
    {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  console.log(
    '[OTP] WhatsApp send accepted. phoneNumberId=%s to=%s response=%s',
    config.phoneNumberId,
    to,
    JSON.stringify(response?.data)
  );
};

const sendOtp = async (mobile, purpose) => {
  await OtpVerification.deleteMany({ mobile, purpose });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await OtpVerification.create({ mobile, code, purpose, expiresAt });

  const label = purpose === 'SIGNUP' ? 'account signup' : 'password reset';
  let sent = false;
  let error = null;
  try {
    await sendWhatsAppOtpMessage(
      mobile,
      `Your WhatsApp BSP ${label} OTP is: ${code}\nValid for 10 minutes. Do not share this code.`
    );
    sent = true;
  } catch (err) {
    error = err?.response?.data?.error?.message || err.message;
    console.error('[OTP] WhatsApp send error:', error);
  }

  const result = { sent, error };
  if (process.env.NODE_ENV !== 'production') result.devOtp = code;
  return result;
};

const verifyOtp = async (mobile, code, purpose) => {
  const otp = await OtpVerification.findOne({
    mobile,
    code,
    purpose,
    used: false,
    expiresAt: { $gt: new Date() },
  });
  if (!otp) return false;
  otp.used = true;
  await otp.save();
  return true;
};

module.exports = { sendOtp, verifyOtp };
