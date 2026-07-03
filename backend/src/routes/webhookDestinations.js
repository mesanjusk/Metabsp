const express = require('express');
const WebhookDestination = require('../models/WebhookDestination');
const WhatsAppAccount = require('../repositories/whatsappAccount');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_URL_PREFIXES = /^https?:\/\//;
const PRIVATE_IP = /^https?:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/i;

function validateUrl(url) {
  if (!url || typeof url !== 'string') return 'url is required';
  if (!ALLOWED_URL_PREFIXES.test(url)) return 'url must start with http:// or https://';
  if (PRIVATE_IP.test(url)) return 'url must not target a private/local/link-local IP address';
  try { new URL(url); } catch (_) { return 'url is not a valid URL'; }
  return null;
}

function sanitize(dest) {
  return {
    id: String(dest._id),
    label: dest.label,
    url: dest.url,
    isActive: dest.isActive,
    secretPreview: dest.secret ? `${dest.secret.slice(0, 6)}…` : '',
    lastAttemptAt: dest.lastAttemptAt,
    lastStatus: dest.lastStatus,
    lastError: dest.lastError,
    createdAt: dest.createdAt,
  };
}

// Resolves (and one-time-migrates) the caller's active WhatsApp account.
async function resolveOwnedAccount(req) {
  const account = await WhatsAppAccount.findOne({ userId: req.user.id, isActive: true }).sort({ updatedAt: -1 });
  if (!account) return null;

  // One-time migration: a legacy single `callbackUrl` becomes a "Default" destination.
  if (account.callbackUrl) {
    const existing = await WebhookDestination.countDocuments({ whatsappAccountId: account._id });
    if (existing === 0) {
      await WebhookDestination.create({
        userId: req.user.id,
        whatsappAccountId: account._id,
        label: 'Default',
        url: account.callbackUrl,
        secret: WebhookDestination.generateSecret(),
        isActive: true,
      });
    }
    account.callbackUrl = '';
    await account.save();
  }

  return account;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const account = await resolveOwnedAccount(req);
    if (!account) return res.json({ success: true, data: [] });
    const destinations = await WebhookDestination.find({ whatsappAccountId: account._id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: destinations.map(sanitize) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { label = 'My project', url, isActive } = req.body || {};
    const urlError = validateUrl(url);
    if (urlError) return res.status(400).json({ success: false, error: urlError });

    const account = await WhatsAppAccount.findOne({ userId: req.user.id, isActive: true }).sort({ updatedAt: -1 });
    if (!account) return res.status(400).json({ success: false, error: 'Connect a WhatsApp number before adding webhook destinations.' });

    const dest = await WebhookDestination.create({
      userId: req.user.id,
      whatsappAccountId: account._id,
      label: String(label || 'My project').trim() || 'My project',
      url,
      secret: WebhookDestination.generateSecret(),
      isActive: isActive !== false,
    });
    res.status(201).json({ success: true, data: sanitize(dest) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { label, url, isActive } = req.body || {};
    if (url !== undefined) {
      const urlError = validateUrl(url);
      if (urlError) return res.status(400).json({ success: false, error: urlError });
    }
    const update = {};
    if (label !== undefined) update.label = String(label).trim() || 'My project';
    if (url !== undefined) update.url = url;
    if (isActive !== undefined) update.isActive = Boolean(isActive);

    const dest = await WebhookDestination.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!dest) return res.status(404).json({ success: false, error: 'Webhook destination not found' });
    res.json({ success: true, data: sanitize(dest) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/regenerate-secret', requireAuth, async (req, res) => {
  try {
    const dest = await WebhookDestination.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { secret: WebhookDestination.generateSecret() } },
      { new: true }
    );
    if (!dest) return res.status(404).json({ success: false, error: 'Webhook destination not found' });
    res.json({ success: true, data: sanitize(dest) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await WebhookDestination.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!deleted) return res.status(404).json({ success: false, error: 'Webhook destination not found' });
    res.json({ success: true, message: 'Webhook destination deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
