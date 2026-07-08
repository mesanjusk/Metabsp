const jwt = require('jsonwebtoken');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Role = require('../models/Role');
const { sendOtp, verifyOtp } = require('../services/otpService');
const { getJwtSecret } = require('../utils/jwtSecret');
const { PERMISSIONS } = require('../utils/permissions');
const logger = require('../../src/utils/logger');

function generateToken(userId) {
  return jwt.sign({ id: userId, type: 'db-user' }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

// Default roles seeded for every new organization. Permission strings match
// frontend/src/utils/accessControl.js's MODULE_PERMISSIONS vocabulary so the
// backend's permit() middleware and the frontend's canAccess() agree.
const DEFAULT_ROLES = [
  { name: 'Admin',        code: 'ADMIN',        permissions: ['*'], dashboardKey: 'admin' },
  { name: 'Team Leader',  code: 'TEAM_LEADER',  permissions: [PERMISSIONS.dashboard_view, PERMISSIONS.users_manage, PERMISSIONS.categories_manage, PERMISSIONS.stage_manage, PERMISSIONS.budget_manage, PERMISSIONS.notifications_view, PERMISSIONS.whatsapp_send], dashboardKey: 'team_leader' },
  { name: 'Volunteer',    code: 'VOLUNTEER',    permissions: [PERMISSIONS.dashboard_view, PERMISSIONS.stage_manage], dashboardKey: 'volunteer' },
  { name: 'Anchor',       code: 'ANCHOR',       permissions: [PERMISSIONS.dashboard_view, PERMISSIONS.stage_manage], dashboardKey: 'anchor' },
  { name: 'Guest',        code: 'GUEST',        permissions: [PERMISSIONS.dashboard_view], dashboardKey: 'guest' },
  { name: 'Student',      code: 'STUDENT',      permissions: [PERMISSIONS.dashboard_view], dashboardKey: 'student' },
];

async function seedOrgRoles(tenantId) {
  for (const r of DEFAULT_ROLES) {
    await Role.findOneAndUpdate(
      { code: r.code, tenantId },
      { ...r, tenantId },
      { upsert: true, new: true }
    );
  }
  return Role.findOne({ code: 'ADMIN', tenantId });
}

// ── Check mobile (before signup) ──────────────────────────────────────────────
async function checkMobile(req, res) {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ message: 'Mobile number is required' });

    const clean = String(mobile).trim();
    const exists = await User.findOne({ mobile: clean });
    return res.json({ exists: !!exists });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── Step 1: Request signup OTP ────────────────────────────────────────────────
async function requestSignupOtp(req, res) {
  try {
    const { mobile, orgName, adminName, password } = req.body;

    if (!mobile || !orgName || !adminName || !password) {
      return res.status(400).json({
        message: 'Mobile, organization name, your name and password are all required',
      });
    }

    const clean = String(mobile).trim();

    const existing = await User.findOne({ mobile: clean });
    if (existing) {
      return res.status(409).json({
        message: 'An account with this mobile number already exists. Please log in or reset your password.',
        redirectTo: 'forgot-password',
      });
    }

    const result = await sendOtp(clean, 'SIGNUP');
    return res.json({
      message: result.sent
        ? 'OTP sent to your WhatsApp number'
        : 'OTP generated (WhatsApp not connected — check devOtp in non-production)',
      ...(result.devOtp ? { devOtp: result.devOtp } : {}),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── Step 2: Verify signup OTP → create org + admin user ───────────────────────
async function verifySignupOtp(req, res) {
  try {
    const { mobile, otp, orgName, adminName, password } = req.body;

    if (!mobile || !otp || !orgName || !adminName || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const clean = String(mobile).trim();

    const { valid } = await verifyOtp(clean, otp, 'SIGNUP');
    if (!valid) {
      return res.status(400).json({ message: 'Invalid or expired OTP. Please try again.' });
    }

    const existing = await User.findOne({ mobile: clean });
    if (existing) {
      return res.status(409).json({
        message: 'Account already exists. Please log in.',
        redirectTo: 'login',
      });
    }

    // Create org
    const org = await Organization.create({ name: orgName, mobile: clean });

    // Seed default roles for this org
    const adminRole = await seedOrgRoles(org._id);

    // Create admin user for the org
    const user = await User.create({
      name: adminName,
      username: clean, // mobile as username
      password,
      mobile: clean,
      roleId: adminRole._id,
      tenantId: org._id,
      eventDutyType: 'ADMIN',
      isActive: true,
    });

    const populated = await User.findById(user._id).populate('roleId');
    return res.status(201).json({
      token: generateToken(user._id),
      user: populated,
      org,
      message: 'Account created successfully! Welcome.',
    });
  } catch (err) {
    logger.error('[org] verifySignupOtp:', err);
    res.status(500).json({ message: err.message });
  }
}

// ── Forgot password: request OTP ──────────────────────────────────────────────
async function requestForgotOtp(req, res) {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ message: 'Mobile number is required' });

    const clean = String(mobile).trim();
    const user = await User.findOne({ mobile: clean });
    if (!user) {
      return res.status(404).json({
        message: 'No account found with this mobile number. Please sign up.',
        redirectTo: 'signup',
      });
    }

    const result = await sendOtp(clean, 'FORGOT_PASSWORD');
    return res.json({
      message: result.sent
        ? 'OTP sent to your WhatsApp number'
        : 'OTP generated (WhatsApp not connected)',
      ...(result.devOtp ? { devOtp: result.devOtp } : {}),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── Forgot password: verify OTP + reset ───────────────────────────────────────
async function resetPassword(req, res) {
  try {
    const { mobile, otp, newPassword } = req.body;

    if (!mobile || !otp || !newPassword) {
      return res.status(400).json({ message: 'Mobile, OTP and new password are required' });
    }

    const clean = String(mobile).trim();

    const { valid } = await verifyOtp(clean, otp, 'FORGOT_PASSWORD');
    if (!valid) {
      return res.status(400).json({ message: 'Invalid or expired OTP. Please try again.' });
    }

    const user = await User.findOne({ mobile: clean });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = newPassword;
    await user.save();

    const populated = await User.findById(user._id).populate('roleId');
    return res.json({
      message: 'Password reset successfully. Logging you in.',
      token: generateToken(user._id),
      user: populated,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── List all orgs (super admin only) ─────────────────────────────────────────
async function listOrgs(req, res) {
  try {
    const orgs = await Organization.find().sort({ createdAt: -1 });
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  checkMobile,
  requestSignupOtp,
  verifySignupOtp,
  requestForgotOtp,
  resetPassword,
  listOrgs,
};
