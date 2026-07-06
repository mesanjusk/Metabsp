const axios = require('axios');
const OtpVerification = require('../models/OtpVerification');
const { resolveLegacyEnvConfig } = require('./whatsappAccountService');
const normalizeWhatsAppNumber = require('../utils/normalizeNumber');

const OTP_TTL_MS = 10 * 60 * 1000;
// Must match an approved WhatsApp "Authentication" category template (e.g.
// the instify_otp template) — see WHATSAPP_OTP_TEMPLATE_NAME.
const OTP_TEMPLATE_NAME = process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'instify_otp';
const OTP_TEMPLATE_LANGUAGE = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'en_US';

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// A brand-new registrant has no open 24h conversation window with the
// business number, so a free-form text send (the previous approach) is
// rejected by the Graph API for first contact. Authentication-category
// template messages are the only way to reach them outside that window.
const sendWhatsAppOtpMessage = async (mobile, code) => {
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
      type: 'template',
      template: {
        name: OTP_TEMPLATE_NAME,
        language: { code: OTP_TEMPLATE_LANGUAGE },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
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

  let sent = false;
  let error = null;
  try {
    await sendWhatsAppOtpMessage(mobile, code);
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
