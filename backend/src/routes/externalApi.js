/**
 * External API (v1) — machine-to-machine messaging for other systems.
 *
 * Authenticated with an API key rather than a JWT, so a customer's own backend
 * can send WhatsApp messages without a browser session. See
 * docs/api/AUTHENTICATION.md.
 *
 * Endpoints:
 *   GET  /api/v1/status            — Connected WhatsApp account + its status
 *   POST /api/v1/send-text         — Send a text message
 *   POST /api/v1/send-image        — Send an image with an optional caption
 *   POST /api/v1/send-template     — Send an approved template message
 *
 * Everything here runs on the official WhatsApp Cloud API. These routes used
 * to drive an unofficial WhatsApp Web session (Baileys), which meant free-form
 * blasts to arbitrary recipients — something the Cloud API deliberately does
 * not allow. Two consequences are visible in the contract below and are not
 * bugs:
 *
 *   • Free-form text only reaches a recipient inside Meta's 24-hour customer
 *     service window, i.e. someone who messaged the business recently.
 *     Outside it, use /send-template.
 *   • Bulk send is gone. Broadcasting is a template operation and goes through
 *     POST /api/whatsapp/broadcast, which enqueues per-recipient jobs and
 *     respects Meta's rate limits, rather than looping with a sleep().
 */

const express = require('express');
const { requireApiKey } = require('../middleware/apiKeyAuth');
const { createRateLimiter } = require('../middleware/rateLimit');
const {
  dispatchTextMessage,
  dispatchTemplateMessage,
  dispatchMediaMessage,
} = require('../controllers/whatsappController');
const { loadActiveWhatsAppAccountForUser } = require('../services/whatsappAccountService');
const logger = require('../utils/logger');

const router = express.Router();
const limiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 60 });

const normalizePhone = (v) => String(v || '').replace(/\D/g, '');

// Meta's own error text is the useful part of a failure ("template does not
// exist", "recipient not in allowed list"), so it is surfaced rather than
// flattened into "Something went wrong". Stack traces never are.
const respondWithError = (res, error, operation) => {
  const metaMessage = error?.response?.data?.error?.message;
  const metaCode = error?.response?.data?.error?.code;
  const status = error?.statusCode && error.statusCode >= 400 && error.statusCode <= 599 ? error.statusCode : 502;

  if (!metaMessage) logger.error(`[external-api] ${operation} failed:`, error.message);

  return res.status(status).json({
    success: false,
    operation,
    message: metaMessage || error.message || `${operation} failed`,
    ...(metaCode ? { code: metaCode } : {}),
  });
};

// Every route resolves the account from the API key's own user, so a key can
// only ever act on the WhatsApp number its owner connected. Recipient or
// account IDs supplied in the body are never trusted for that decision.
const withAccount = (handler) => async (req, res) => {
  let accountContext;
  try {
    accountContext = await loadActiveWhatsAppAccountForUser(req.user.id);
  } catch (error) {
    return res.status(409).json({
      success: false,
      message: 'No active WhatsApp account is connected for this API key. Connect one in the dashboard first.',
    });
  }
  return handler({ req, res, accountContext });
};

router.get(
  '/status',
  requireApiKey,
  withAccount(async ({ res, accountContext }) => {
    const account = accountContext?.account;
    return res.json({
      success: true,
      data: {
        connected: true,
        phoneNumberId: accountContext.phoneNumberId || '',
        displayPhoneNumber: account?.displayPhoneNumber || '',
        verifiedName: account?.verifiedName || '',
        connectionMode: account?.connectionMode || '',
        status: account?.status || '',
      },
    });
  })
);

router.post(
  '/send-text',
  requireApiKey,
  limiter,
  withAccount(async ({ req, res, accountContext }) => {
    const phone = normalizePhone(req.body?.phone || req.body?.to);
    const text = String(req.body?.text || req.body?.message || '');
    if (!phone || !text) {
      return res.status(400).json({ success: false, message: 'phone and text are required' });
    }
    try {
      await dispatchTextMessage({ accountContext, userId: req.user.id, to: phone, body: text });
      return res.json({ success: true, message: 'Message sent' });
    } catch (error) {
      return respondWithError(res, error, 'send-text');
    }
  })
);

router.post(
  '/send-image',
  requireApiKey,
  limiter,
  withAccount(async ({ req, res, accountContext }) => {
    const phone = normalizePhone(req.body?.phone || req.body?.to);
    const link = String(req.body?.imageUrl || req.body?.link || '');
    if (!phone || !link) {
      return res.status(400).json({ success: false, message: 'phone and imageUrl are required' });
    }
    try {
      await dispatchMediaMessage({
        accountContext,
        userId: req.user.id,
        to: phone,
        link,
        type: 'image',
        caption: String(req.body?.caption || ''),
      });
      return res.json({ success: true, message: 'Image sent' });
    } catch (error) {
      return respondWithError(res, error, 'send-image');
    }
  })
);

router.post(
  '/send-template',
  requireApiKey,
  limiter,
  withAccount(async ({ req, res, accountContext }) => {
    const phone = normalizePhone(req.body?.phone || req.body?.to);
    const templateName = String(req.body?.template || req.body?.templateName || '');
    if (!phone || !templateName) {
      return res.status(400).json({ success: false, message: 'phone and template are required' });
    }
    try {
      await dispatchTemplateMessage({
        accountContext,
        userId: req.user.id,
        to: phone,
        templateName,
        language: String(req.body?.language || 'en_US'),
        components: Array.isArray(req.body?.components) ? req.body.components : [],
      });
      return res.json({ success: true, message: 'Template sent' });
    } catch (error) {
      return respondWithError(res, error, 'send-template');
    }
  })
);

module.exports = router;
