const express = require('express');
const RoutingConfig = require('../models/RoutingConfig');
const { requireAuth } = require('../middleware/auth');
const { protect } = require('../../bulk/middleware/auth');

const router = express.Router();

// Accept either Metabsp JWT (requireAuth) or Bulk JWT (protect).
// The middleware tries Metabsp first; if it fails the other is tried below.
// Simplest: use protect (bulk) since the admin panel lives in the bulk UI.
const guard = protect;

const ALLOWED_URL_PREFIXES = /^https?:\/\//;
const PRIVATE_IP = /^https?:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/i;

function validateAppUrl(url) {
  if (!url || typeof url !== 'string') return 'appUrl is required';
  if (!ALLOWED_URL_PREFIXES.test(url)) return 'appUrl must start with http:// or https://';
  if (PRIVATE_IP.test(url)) return 'appUrl must not target a private/local IP address';
  try { new URL(url); } catch (_) { return 'appUrl is not a valid URL'; }
  return null;
}

router.get('/', guard, async (req, res) => {
  try {
    const configs = await RoutingConfig.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: configs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', guard, async (req, res) => {
  try {
    const { phoneNumberId, appName, appUrl, isActive } = req.body;
    if (!phoneNumberId || !appName || !appUrl) {
      return res.status(400).json({ success: false, error: 'phoneNumberId, appName and appUrl are required' });
    }
    const urlError = validateAppUrl(appUrl);
    if (urlError) return res.status(400).json({ success: false, error: urlError });
    const config = await RoutingConfig.create({ phoneNumberId, appName, appUrl, isActive: isActive !== false });
    res.status(201).json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', guard, async (req, res) => {
  try {
    const { phoneNumberId, appName, appUrl, isActive } = req.body;
    if (appUrl !== undefined) {
      const urlError = validateAppUrl(appUrl);
      if (urlError) return res.status(400).json({ success: false, error: urlError });
    }
    const config = await RoutingConfig.findByIdAndUpdate(
      req.params.id,
      { $set: { phoneNumberId, appName, appUrl, isActive } },
      { new: true, runValidators: true }
    );
    if (!config) return res.status(404).json({ success: false, error: 'Routing config not found' });
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', guard, async (req, res) => {
  try {
    const config = await RoutingConfig.findByIdAndDelete(req.params.id);
    if (!config) return res.status(404).json({ success: false, error: 'Routing config not found' });
    res.json({ success: true, message: 'Routing config deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
