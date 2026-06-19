const ApiKey = require('../../bulk/models/ApiKey');

const requireApiKey = async (req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!key) return res.status(401).json({ success: false, error: 'Missing X-Api-Key header' });

  const record = await ApiKey.findOne({ key, isActive: true }).lean();
  if (!record) return res.status(401).json({ success: false, error: 'Invalid or revoked API key' });

  req.user = { id: record.userId };
  // Non-blocking last-used update
  ApiKey.findByIdAndUpdate(record._id, { lastUsedAt: new Date() }).catch(() => {});
  next();
};

module.exports = { requireApiKey };
