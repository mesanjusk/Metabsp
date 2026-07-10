/**
 * External API — v1
 *
 * Allows external applications to send WhatsApp messages through a user's
 * connected Baileys session using an API key (no JWT required).
 *
 * Authentication:
 *   Header:  X-Api-Key: mbsp_<key>
 *   OR Query: ?apiKey=mbsp_<key>
 *
 * Base path (mounted in index.js): /api/v1
 *
 * Endpoints:
 *   GET  /api/v1/baileys/status         — Check connection status
 *   POST /api/v1/baileys/send           — Send text or image+caption
 *   POST /api/v1/baileys/send-text      — Send text only (alias)
 *   POST /api/v1/baileys/send-image     — Send image with caption
 *   POST /api/v1/baileys/send-bulk      — Send to multiple recipients
 */

const express      = require('express');
const { requireApiKey } = require('../middleware/apiKeyAuth');
const { requireBaileysEnabled } = require('../../bulk/middleware/baileysGate');
const { createRateLimiter } = require('../middleware/rateLimit');
const baileysService = require('../../bulk/services/baileysService');
const logger = require('../utils/logger');

const router = express.Router();
const limiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 60 });

function normalizePhone(v) {
  const d = String(v || '').replace(/\D/g, '').trim();
  return d.length === 10 ? '91' + d : d;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── GET /baileys/status ───────────────────────────────────────────────────────
router.get('/baileys/status', requireApiKey, requireBaileysEnabled, (req, res) => {
  const status = baileysService.getStatus(req.user.id);
  res.json({ success: true, ...status });
});

// ── POST /baileys/send ────────────────────────────────────────────────────────
// Unified send: sends text or image depending on whether imageUrl is provided.
//
// Body:
//   { "to": "919876543210", "message": "Hello!" }
//   { "to": "919876543210", "message": "Caption", "imageUrl": "https://..." }
router.post('/baileys/send', requireApiKey, requireBaileysEnabled, limiter, async (req, res) => {
  const { to, message, imageUrl } = req.body;
  if (!to)      return res.status(400).json({ success: false, error: '"to" is required' });
  if (!message) return res.status(400).json({ success: false, error: '"message" is required' });

  const phone = normalizePhone(to);
  try {
    if (imageUrl) {
      await baileysService.sendImage(req.user.id, { to: phone, imageUrl, caption: message });
    } else {
      await baileysService.sendText(req.user.id, { to: phone, body: message });
    }
    res.json({ success: true, to: phone });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /baileys/send-text ───────────────────────────────────────────────────
router.post('/baileys/send-text', requireApiKey, requireBaileysEnabled, limiter, async (req, res) => {
  const { to, message, body } = req.body;
  const text  = message || body;
  const phone = normalizePhone(to);
  if (!phone) return res.status(400).json({ success: false, error: '"to" is required' });
  if (!text)  return res.status(400).json({ success: false, error: '"message" is required' });
  try {
    await baileysService.sendText(req.user.id, { to: phone, body: text });
    res.json({ success: true, to: phone });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /baileys/send-image ──────────────────────────────────────────────────
router.post('/baileys/send-image', requireApiKey, requireBaileysEnabled, limiter, async (req, res) => {
  const { to, imageUrl, caption = '' } = req.body;
  const phone = normalizePhone(to);
  if (!phone)    return res.status(400).json({ success: false, error: '"to" is required' });
  if (!imageUrl) return res.status(400).json({ success: false, error: '"imageUrl" is required' });
  try {
    await baileysService.sendImage(req.user.id, { to: phone, imageUrl, caption });
    res.json({ success: true, to: phone });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /baileys/send-bulk ───────────────────────────────────────────────────
// Body:
//   {
//     "recipients": [
//       { "to": "919876543210", "message": "Hi John!" },
//       { "to": "919876543211", "message": "Hi Jane!", "imageUrl": "https://..." }
//     ],
//     "delay": 12000   // ms between sends (default 12000, min 5000, max 60000)
//   }
router.post('/baileys/send-bulk', requireApiKey, requireBaileysEnabled, async (req, res) => {
  const { recipients, delay = 12000 } = req.body;
  if (!Array.isArray(recipients) || !recipients.length) {
    return res.status(400).json({ success: false, error: '"recipients" must be a non-empty array' });
  }
  if (recipients.length > 500) {
    return res.status(400).json({ success: false, error: 'Maximum 500 recipients per bulk send' });
  }

  const actualDelay = Math.min(60000, Math.max(5000, Number(delay) || 12000));
  const results = [];

  // Respond immediately, process in background
  res.json({ success: true, total: recipients.length, delay: actualDelay, message: 'Bulk send started' });

  for (let i = 0; i < recipients.length; i++) {
    const { to, message, body, imageUrl } = recipients[i];
    const text  = message || body;
    const phone = normalizePhone(to);
    try {
      if (!phone || !text) { results.push({ to: phone || to, status: 'SKIPPED', error: 'Missing to or message' }); continue; }
      if (imageUrl) {
        await baileysService.sendImage(req.user.id, { to: phone, imageUrl, caption: text });
      } else {
        await baileysService.sendText(req.user.id, { to: phone, body: text });
      }
      results.push({ to: phone, status: 'SENT' });
    } catch (e) {
      results.push({ to: phone || to, status: 'FAILED', error: e.message });
    }
    if (i < recipients.length - 1) await sleep(actualDelay);
  }

  logger.info(`[external-api] bulk send complete: ${results.filter(r => r.status === 'SENT').length}/${results.length} sent`);
});

module.exports = router;
