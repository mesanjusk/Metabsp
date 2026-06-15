const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getJwtSecret() {
  return process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || 'change-me-in-env';
}

function generateDbToken(id) {
  return jwt.sign({ id, type: 'db-user' }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

function generateBootstrapToken(username) {
  return jwt.sign(
    { id: 'hardcoded-super-admin', username, type: 'bootstrap-user', isHardcoded: true, role: 'SUPER_ADMIN' },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
}

function canUseBootstrapLogin() {
  // Works whenever BOOTSTRAP_USERNAME + PASSWORD are explicitly set in env —
  // including production. Setting these vars is itself the opt-in signal.
  return !!(process.env.BOOTSTRAP_USERNAME && process.env.BOOTSTRAP_PASSWORD);
}

async function login(req, res) {
  try {
    const { username, password, mobile } = req.body;
    const identifier = (mobile || username || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Mobile/username and password are required' });
    }

    // Bootstrap (hardcoded) super admin
    const bsUser = process.env.BOOTSTRAP_USERNAME;
    const bsPass = process.env.BOOTSTRAP_PASSWORD;
    if (canUseBootstrapLogin() && bsUser && bsPass && identifier === bsUser && password === bsPass) {
      return res.json({
        token: generateBootstrapToken(bsUser),
        user: {
          _id: 'hardcoded-super-admin',
          name: process.env.BOOTSTRAP_NAME || 'Super Admin',
          username: bsUser,
          mobile: '',
          email: '',
          isActive: true,
          isHardcoded: true,
          eventDutyType: 'SUPER_ADMIN',
          availabilityStatus: 'AVAILABLE',
          stageCounts: { anchorCalls: 0, guestAwards: 0, volunteerAssignments: 0, teamAssignments: 0 },
          roleId: { _id: 'hardcoded-role-super-admin', name: 'Super Admin', code: 'SUPER_ADMIN', permissions: ['*'] },
        },
      });
    }

    // DB lookup — support login by mobile OR username
    const user = await User.findOne({
      $or: [{ mobile: identifier }, { username: identifier }],
    }).populate('roleId');

    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.isActive) return res.status(403).json({ message: 'Account is inactive' });

    const ok = await user.matchPassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    return res.json({ token: generateDbToken(user._id), user });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Login failed' });
  }
}

async function me(req, res) {
  return res.json(req.user);
}

module.exports = { login, me, getJwtSecret };
