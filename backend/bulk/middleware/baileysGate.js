const Organization = require('../models/Organization');

// Gates any Baileys/WhatsApp-Web route behind Organization.baileysEnabled.
// Requires `protect` (or another middleware that sets req.tenantId) to run
// first. req.tenantId === null means a super-admin/global account — always
// allowed through, since super admins need access regardless of any
// customer's flag (support, testing, and toggling the flag itself).
async function requireBaileysEnabled(req, res, next) {
  try {
    if (!req.tenantId) return next();

    const org = await Organization.findById(req.tenantId).select('baileysEnabled').lean();
    if (org?.baileysEnabled) return next();

    return res.status(403).json({
      success: false,
      message: 'This feature is not enabled for your account. Contact support to enable WhatsApp-Web based features.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { requireBaileysEnabled };
