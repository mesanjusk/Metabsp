const ApiKey = require('../../bulk/models/ApiKey');
const User = require('../../bulk/models/User');

const requireApiKey = async (req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!key) return res.status(401).json({ success: false, error: 'Missing X-Api-Key header' });

  const record = await ApiKey.findOne({ key, isActive: true }).lean();
  if (!record) return res.status(401).json({ success: false, error: 'Invalid or revoked API key' });

  req.user = { id: record.userId };
  // Resolve tenantId so downstream feature-flag gates (e.g. requireBaileysEnabled)
  // can check the key owner's organization, same as the JWT auth path does.
  // Never let this fail the whole request — a lookup problem here should
  // just mean "treat as no tenant", not break API-key auth entirely.
  try {
    const owner = await User.findById(record.userId).select('tenantId').lean();
    req.tenantId = owner?.tenantId || null;
  } catch {
    req.tenantId = null;
  }
  // Non-blocking last-used update
  ApiKey.findByIdAndUpdate(record._id, { lastUsedAt: new Date() }).catch(() => {});
  next();
};

module.exports = { requireApiKey };
