const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { getJwtSecret } = require('../utils/jwtSecret');

function generateDbToken(id) {
  return jwt.sign({ id, type: 'db-user' }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

// Upserts a real DB user for the env-configured bootstrap super-admin, so the
// issued token is a normal db-user token verified against the DB on every
// request (not a claims-only token that stays "valid" forever, even after the
// BOOTSTRAP_* env vars are rotated or removed).
async function upsertBootstrapUser(username, password) {
  const role = await Role.findOneAndUpdate(
    { code: 'SUPER_ADMIN', tenantId: null },
    { name: 'Super Admin', code: 'SUPER_ADMIN', permissions: ['*'], tenantId: null, dashboardKey: 'super_admin' },
    { new: true, upsert: true }
  );

  let user = await User.findOne({ username, tenantId: null });
  if (!user) {
    user = await User.create({
      name: process.env.BOOTSTRAP_NAME || 'Super Admin',
      username,
      password,
      roleId: role._id,
      tenantId: null,
      eventDutyType: 'SUPER_ADMIN',
      isActive: true,
    });
  } else if (!(await user.matchPassword(password))) {
    // Keep the DB account in sync if BOOTSTRAP_PASSWORD was rotated.
    user.password = password;
    await user.save();
  }
  return user;
}

function canUseBootstrapLogin() {
  // Works whenever BOOTSTRAP_USERNAME + PASSWORD are explicitly set in env —
  // including production. Setting these vars is itself the opt-in signal.
  return !!(process.env.BOOTSTRAP_USERNAME && process.env.BOOTSTRAP_PASSWORD);
}

// Attaches the org's baileysEnabled flag to a user payload so the frontend
// can hide/show Baileys-related tabs without a separate round trip — off by
// default for every organization (see models/Organization.js) until a super
// admin flips it on for that customer (PATCH /api/bulk/org/:id/baileys).
//
// Super admin / no-org accounts have no Organization document to carry this
// flag, but they should still default to "off" in the UI — Baileys/
// WhatsApp-Web features must not be visible-by-default on the account used
// for Meta App Review demos. requireBaileysEnabled (src/middleware/
// baileysGate.js) still lets super admins through at the API layer
// regardless of this flag (support/testing), this only controls what the
// frontend shows by default.
async function withBaileysFlag(userDoc) {
  const payload = userDoc?.toObject ? userDoc.toObject() : { ...userDoc };
  if (!payload.tenantId) {
    payload.baileysEnabled = false;
    return payload;
  }
  const Organization = require('../models/Organization');
  const org = await Organization.findById(payload.tenantId).select('baileysEnabled').lean();
  payload.baileysEnabled = !!org?.baileysEnabled;
  return payload;
}

async function login(req, res) {
  try {
    const { username, password, mobile } = req.body;
    const identifier = (mobile || username || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Mobile/username and password are required' });
    }

    // Bootstrap (env-configured) super admin — upserts a real DB user so the
    // issued token is a normal, DB-verified session (see upsertBootstrapUser).
    const bsUser = process.env.BOOTSTRAP_USERNAME;
    const bsPass = process.env.BOOTSTRAP_PASSWORD;
    if (canUseBootstrapLogin() && bsUser && bsPass && identifier === bsUser && password === bsPass) {
      const bootstrapUser = await upsertBootstrapUser(bsUser, bsPass);
      const populated = await User.findById(bootstrapUser._id).populate('roleId');
      return res.json({ token: generateDbToken(bootstrapUser._id), user: await withBaileysFlag(populated) });
    }

    // DB lookup — support login by mobile OR username
    let user = await User.findOne({
      $or: [{ mobile: identifier }, { username: identifier }],
    }).populate('roleId');

    // Fallback: last-10-digit regex (handles +91 prefix stored vs bare 10-digit typed)
    if (!user) {
      const digits = identifier.replace(/\D/g, '');
      const last10 = digits.slice(-10);
      if (last10.length === 10) {
        user = await User.findOne({ mobile: { $regex: last10 + '$' } }).populate('roleId');
      }
    }

    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.isActive) return res.status(403).json({ message: 'Account is inactive' });

    const ok = await user.matchPassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    return res.json({ token: generateDbToken(user._id), user: await withBaileysFlag(user) });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Login failed' });
  }
}

async function me(req, res) {
  return res.json(await withBaileysFlag(req.user));
}

async function magicLogin(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'Token is required' });

    const user = await User.findOne({
      magicToken: token,
      magicTokenExpire: { $gt: new Date() },
    }).populate('roleId');

    if (!user) {
      return res.status(400).json({ message: 'Magic link is invalid or has expired' });
    }

    user.magicToken = undefined;
    user.magicTokenExpire = undefined;
    await user.save();

    return res.json({ token: generateDbToken(user._id), user });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Magic login failed' });
  }
}

module.exports = { login, me, magicLogin };
