const AppError = require('../utils/AppError');
const { protect, permit } = require('../../bulk/middleware/auth');

// requireAuth now delegates to the single unified auth path (backend/bulk/middleware/auth.js):
// it DB-verifies the JWT against the unified User collection on every request (no more
// claims-only tokens), populates roleId, and sets req.tenantId. isAdmin is derived from
// the role's permissions so existing `req.user.isAdmin` checks across the Metabsp routes
// keep working unchanged.
const requireAuth = (req, res, next) => {
  return protect(req, res, (err) => {
    if (err) return next(err);
    if (req.user) {
      const permissions = req.user?.roleId?.permissions || [];
      req.user.isAdmin = permissions.includes('*');
    }
    return next();
  });
};

const requireAdmin = (req, _res, next) => {
  if (!req.user?.isAdmin) {
    return next(new AppError('Admin access required', 403));
  }
  return next();
};

module.exports = { requireAuth, requireAdmin, protect, permit };
