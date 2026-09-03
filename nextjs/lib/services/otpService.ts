import axios from 'axios';
import CloudOtpVerification from '../models/CloudOtpVerification';
import { loadPlatformSenderAccount } from './whatsappAccountService';
import normalizeWhatsAppNumber from '../utils/normalizeNumber';
import logger from '../utils/logger';

// Ported from backend/src/services/otpService.js. Sends from the platform's
// own number rather than any tenant's — a brand-new registrant has no 24h
// session window with anybody, so this is always a template send.
//
// The original read WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID directly.
// It now resolves the admin account connected in the dashboard, so there is
// one place a credential lives and one place to correct it.
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_TEMPLATE_NAME = process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'instify_otp';
const OTP_TEMPLATE_LANGUAGE = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'en_US';

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendWhatsAppOtpMessage = async (mobile: string, code: string) => {
  const config: any = await loadPlatformSenderAccount();
  if (!config) {
    throw new Error(
      'No WhatsApp number is connected on the admin account, so signup and password-reset codes cannot be ' +
        'sent. Connect it under the admin\'s WhatsApp settings.'
    );
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
      headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  );

  // The source is logged because "the OTP went to the old number" is
  // otherwise indistinguishable from "the OTP did not send".
  logger.info(
    '[OTP] WhatsApp send accepted. source=%s phoneNumberId=%s to=%s response=%s',
    config.source || 'unknown',
    config.phoneNumberId,
    to,
    JSON.stringify(response?.data)
  );
};

export const sendOtp = async (mobile: string, purpose: 'SIGNUP' | 'RESET') => {
  await CloudOtpVerification.deleteMany({ mobile, purpose });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await CloudOtpVerification.create({ mobile, code, purpose, expiresAt });

  let sent = false;
  let error: string | null = null;
  try {
    await sendWhatsAppOtpMessage(mobile, code);
    sent = true;
  } catch (err: any) {
    error = err?.response?.data?.error?.message || err.message;
    logger.error('[OTP] WhatsApp send error:', error);
  }

  return { sent, error };
};

export const verifyOtp = async (mobile: string, code: string, purpose: 'SIGNUP' | 'RESET'): Promise<boolean> => {
  const otp: any = await CloudOtpVerification.findOne({ mobile, code, purpose, used: false, expiresAt: { $gt: new Date() } });
  if (!otp) return false;
  otp.used = true;
  await otp.save();
  return true;
};
