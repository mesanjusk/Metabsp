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

// Generic words are banned as entry keywords everywhere: they collide across
// projects sharing the number and are only meaningful inside an active
// session. EXIT is reserved as the universal close-session command.
const BANNED_KEYWORDS = ['HI', 'HELLO', 'HEY', 'START', 'MENU', 'HELP', 'STOP', 'YES', 'NO', 'OK'];
const RESERVED_KEYWORDS = ['EXIT'];
const KEYWORD_PATTERN = /^[A-Z][A-Z0-9_-]{1,19}$/;

function normalizeKeyword(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeAliases(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeKeyword).filter(Boolean))];
}

// Validates the keyword + aliases and checks case-insensitive uniqueness
// against every other destination on the same WhatsApp account.
async function validateKeywords({ entryKeyword, aliases, whatsappAccountId, excludeId }) {
  const all = entryKeyword ? [entryKeyword, ...aliases] : aliases;

  for (const kw of all) {
    if (!KEYWORD_PATTERN.test(kw)) {
      return `"${kw}" is not a valid keyword (2-20 chars, letters/digits/_/-, must start with a letter)`;
    }
    if (BANNED_KEYWORDS.includes(kw)) {
      return `"${kw}" is a banned generic word — it cannot be an entry keyword or alias in any project`;
    }
    if (RESERVED_KEYWORDS.includes(kw)) {
      return `"${kw}" is reserved (EXIT closes an active conversation)`;
    }
  }
  if (new Set(all).size !== all.length) return 'entryKeyword and aliases must not repeat';

  if (all.length) {
    const query = { whatsappAccountId, ...(excludeId ? { _id: { $ne: excludeId } } : {}) };
    const siblings = await WebhookDestination.find(query).select('label entryKeyword aliases').lean();
    for (const sibling of siblings) {
      const taken = [sibling.entryKeyword, ...(sibling.aliases || [])].map(normalizeKeyword).filter(Boolean);
      const clash = all.find((kw) => taken.includes(kw));
      if (clash) return `keyword "${clash}" is already taken by destination "${sibling.label}"`;
    }
  }
  return null;
}

function sanitize(dest) {
  return {
    id: String(dest._id),
    label: dest.label,
    url: dest.url,
    isActive: dest.isActive,
    entryKeyword: dest.entryKeyword || '',
    aliases: dest.aliases || [],
    fanoutFallback: Boolean(dest.fanoutFallback),
    // The whole point of this secret is for the owner to hand it to their
    // receiving service so it can verify X-Metabsp-Signature-256 — only the
    // authenticated owner (every route below filters by userId) ever sees
    // this response, so there's no reason to withhold the full value.
    secret: dest.secret || '',
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
    const { label = 'My project', url, isActive, entryKeyword, aliases, fanoutFallback } = req.body || {};
    const urlError = validateUrl(url);
    if (urlError) return res.status(400).json({ success: false, error: urlError });

    const account = await WhatsAppAccount.findOne({ userId: req.user.id, isActive: true }).sort({ updatedAt: -1 });
    if (!account) return res.status(400).json({ success: false, error: 'Connect a WhatsApp number before adding webhook destinations.' });

    const normalizedKeyword = normalizeKeyword(entryKeyword);
    const normalizedAliases = normalizeAliases(aliases);
    const keywordError = await validateKeywords({
      entryKeyword: normalizedKeyword,
      aliases: normalizedAliases,
      whatsappAccountId: account._id,
    });
    if (keywordError) return res.status(400).json({ success: false, error: keywordError });

    const dest = await WebhookDestination.create({
      userId: req.user.id,
      whatsappAccountId: account._id,
      label: String(label || 'My project').trim() || 'My project',
      url,
      secret: WebhookDestination.generateSecret(),
      isActive: isActive !== false,
      entryKeyword: normalizedKeyword,
      aliases: normalizedAliases,
      fanoutFallback: Boolean(fanoutFallback),
    });
    res.status(201).json({ success: true, data: sanitize(dest) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { label, url, isActive, entryKeyword, aliases, fanoutFallback } = req.body || {};
    if (url !== undefined) {
      const urlError = validateUrl(url);
      if (urlError) return res.status(400).json({ success: false, error: urlError });
    }
    const update = {};
    if (label !== undefined) update.label = String(label).trim() || 'My project';
    if (url !== undefined) update.url = url;
    if (isActive !== undefined) update.isActive = Boolean(isActive);
    if (fanoutFallback !== undefined) update.fanoutFallback = Boolean(fanoutFallback);

    if (entryKeyword !== undefined || aliases !== undefined) {
      const existing = await WebhookDestination.findOne({ _id: req.params.id, userId: req.user.id });
      if (!existing) return res.status(404).json({ success: false, error: 'Webhook destination not found' });

      const normalizedKeyword = entryKeyword !== undefined ? normalizeKeyword(entryKeyword) : normalizeKeyword(existing.entryKeyword);
      const normalizedAliases = aliases !== undefined ? normalizeAliases(aliases) : normalizeAliases(existing.aliases);
      const keywordError = await validateKeywords({
        entryKeyword: normalizedKeyword,
        aliases: normalizedAliases,
        whatsappAccountId: existing.whatsappAccountId,
        excludeId: existing._id,
      });
      if (keywordError) return res.status(400).json({ success: false, error: keywordError });

      update.entryKeyword = normalizedKeyword;
      update.aliases = normalizedAliases;
    }

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
