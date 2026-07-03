const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../utils/jwtSecret');

async function protect(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret());

    // Bootstrap logins now upsert a real DB user (see authController.upsertBootstrapUser)
    // and issue a normal db-user token, so every request — including bootstrap sessions —
    // is DB-verified here. No claims-only "trust the token forever" branch anymore.
    const user = await User.findById(decoded.id).populate('roleId');
    if (!user) return res.status(401).json({ message: 'Invalid token user' });
    if (!user.isActive) return res.status(403).json({ message: 'Account is inactive' });

    req.user = user;
    req.tenantId = user.tenantId || null; // null = super admin (global access)
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function permit(permission) {
  return (req, res, next) => {
    const permissions = req.user?.roleId?.permissions || [];
    if (permissions.includes('*')) return next();
    if (!permissions.includes(permission)) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    return next();
  };
}

module.exports = { protect, permit };
