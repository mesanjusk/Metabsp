const express = require('express');
const mongoose = require('mongoose');
const User = require('../../bulk/models/User');
const Role = require('../../bulk/models/Role');
const WhatsAppAccount = require('../repositories/whatsappAccount');
const { encryptSensitiveValue } = require('../utils/crypto');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendOtp, verifyOtp } = require('../services/otpService');
const { getJwtSecret } = require('../../bulk/utils/jwtSecret');
const jwt = require('jsonwebtoken');
const { METABSP_ADMIN_ROLE_CODE, METABSP_USER_ROLE_CODE } = require('../../bulk/seedAdmin');

const router = express.Router();

const RESERVED_USERNAME = 'admin';

// Legacy Metabsp API contract (User_name / User_group / Mobile_number) is kept
// so the existing frontend pages don't need to change, but everything underneath
// is now backed by the single unified `User`/`Role` collection — no more separate
// `Users` collection silently colliding with Bulk-invite's `User` collection.

let roleCache = null;
async function getGlobalRoles() {
  if (roleCache) return roleCache;
  const [adminRole, userRole] = await Promise.all([
    Role.findOne({ code: METABSP_ADMIN_ROLE_CODE, tenantId: null }),
    Role.findOne({ code: METABSP_USER_ROLE_CODE, tenantId: null }),
  ]);
  if (!adminRole || !userRole) {
    throw new Error('Global Metabsp roles are not seeded yet — check server startup logs.');
  }
  roleCache = { adminRole, userRole };
  return roleCache;
}

function isAdminRole(user) {
  return Array.isArray(user?.roleId?.permissions) && user.roleId.permissions.includes('*');
}

const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;
  return {
    id: String(userDoc._id),
    User_name: userDoc.username,
    User_group: isAdminRole(userDoc) ? 'admin' : 'user',
    Mobile_number: userDoc.mobile || '',
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
};

const sanitizeAccount = (accountDoc) => {
  if (!accountDoc) return null;
  return {
    id: String(accountDoc._id),
    phoneNumberId: accountDoc.phoneNumberId || '',
    businessAccountId: accountDoc.businessAccountId || '',
    wabaId: accountDoc.wabaId || '',
    displayPhoneNumber: accountDoc.displayPhoneNumber || '',
    verifiedName: accountDoc.verifiedName || '',
    connectionMode: accountDoc.connectionMode || 'manual',
    isActive: Boolean(accountDoc.isActive),
    status: accountDoc.status || 'active',
    webhookSubscribed: Boolean(accountDoc.webhookSubscribed),
    connectedAt: accountDoc.connectedAt || null,
    lastSyncAt: accountDoc.lastSyncAt || null,
    lastWebhookAt: accountDoc.lastWebhookAt || null,
  };
};

const signTokenForUser = (userId) =>
  jwt.sign({ id: userId, type: 'db-user' }, getJwtSecret(), { expiresIn: '99d' });

router.post('/login', async (req, res) => {
  const { User_name, Password } = req.body || {};
  const normalizedUserName = String(User_name || '').trim();

  if (!normalizedUserName || !Password) {
    return res.status(400).json({ success: false, message: 'User_name and Password are required' });
  }

  try {
    const user = await User.findOne({ username: normalizedUserName, tenantId: null }).populate('roleId');
    if (!user || !(await user.matchPassword(Password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is inactive' });
    }

    const token = signTokenForUser(user._id);
    return res.status(200).json({ success: true, token, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('roleId');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Me endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load user' });
  }
});

router.post('/logout', requireAuth, async (_req, res) => {
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
});

router.get('/manage', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await User.find({ tenantId: null }).populate('roleId').sort({ createdAt: -1 }).lean();
    const userIds = users.map((user) => user._id);
    const accounts = await WhatsAppAccount.find({ userId: { $in: userIds } })
      .sort({ updatedAt: -1 })
      .lean();

    const accountByUserId = new Map();
    for (const account of accounts) {
      const key = String(account.userId);
      if (!accountByUserId.has(key) || account.isActive) {
        accountByUserId.set(key, account);
      }
    }

    return res.status(200).json({
      success: true,
      items: users.map((user) => ({
        ...sanitizeUser(user),
        whatsappAccount: sanitizeAccount(accountByUserId.get(String(user._id))),
      })),
    });
  } catch (error) {
    console.error('Manage users list error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load users' });
  }
});

router.post('/manage', requireAuth, requireAdmin, async (req, res) => {
  const {
    User_name,
    Password,
    Mobile_number = '',
    User_group = 'user',
    whatsapp = {},
  } = req.body || {};

  const normalizedUserName = String(User_name || '').trim();
  const normalizedPassword = String(Password || '').trim();

  if (!normalizedUserName || !normalizedPassword) {
    return res.status(400).json({ success: false, message: 'User name and password are required.' });
  }

  if (normalizedUserName.toLowerCase() === RESERVED_USERNAME) {
    return res.status(400).json({ success: false, message: 'This username is reserved.' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingUser = await User.findOne({ username: normalizedUserName, tenantId: null }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ success: false, message: 'User name already exists.' });
    }

    const { adminRole, userRole } = await getGlobalRoles();
    const roleId = String(User_group || 'user').toLowerCase() === 'admin' ? adminRole._id : userRole._id;

    const createdUsers = await User.create([
      {
        name: normalizedUserName,
        username: normalizedUserName,
        password: normalizedPassword,
        mobile: String(Mobile_number || '').trim(),
        roleId,
        tenantId: null,
        isActive: true,
      },
    ], { session });

    const user = await User.findById(createdUsers[0]._id).populate('roleId').session(session);

    const accessToken = String(whatsapp?.accessToken || '').trim();
    const phoneNumberId = String(whatsapp?.phoneNumberId || '').trim();
    const businessAccountId = String(whatsapp?.businessAccountId || '').trim();
    const wabaId = String(whatsapp?.wabaId || businessAccountId).trim();

    let account = null;
    if (accessToken && phoneNumberId && (businessAccountId || wabaId)) {
      account = await WhatsAppAccount.findOneAndUpdate(
        { userId: user._id, phoneNumberId },
        {
          $set: {
            userId: user._id,
            accountKey: '',
            connectionMode: 'manual',
            phoneNumberId,
            businessAccountId: businessAccountId || wabaId,
            wabaId: wabaId || businessAccountId,
            displayPhoneNumber: String(whatsapp?.displayPhoneNumber || '').trim(),
            verifiedName: String(whatsapp?.verifiedName || '').trim(),
            accessTokenEncrypted: encryptSensitiveValue(accessToken),
            tokenType: 'Bearer',
            status: 'active',
            webhookSubscribed: Boolean(whatsapp?.webhookSubscribed),
            isActive: true,
            connectedAt: new Date(),
            lastSyncAt: new Date(),
            metadata: {
              createdByAdmin: true,
            },
          },
        },
        { upsert: true, new: true, session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      item: {
        ...sanitizeUser(user),
        whatsappAccount: sanitizeAccount(account),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create user error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
});

router.put('/manage/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    User_name,
    Password,
    Mobile_number = '',
    User_group = 'user',
    whatsapp = {},
  } = req.body || {};

  try {
    const user = await User.findById(id).populate('roleId');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const normalizedUserName = String(User_name || user.username).trim();
    if (!normalizedUserName) {
      return res.status(400).json({ success: false, message: 'User name is required.' });
    }

    if (normalizedUserName.toLowerCase() === RESERVED_USERNAME) {
      return res.status(400).json({ success: false, message: 'This username is reserved.' });
    }

    const conflictUser = await User.findOne({ username: normalizedUserName, tenantId: null, _id: { $ne: user._id } }).lean();
    if (conflictUser) {
      return res.status(409).json({ success: false, message: 'User name already exists.' });
    }

    const { adminRole, userRole } = await getGlobalRoles();

    user.username = normalizedUserName;
    user.name = normalizedUserName;
    user.mobile = String(Mobile_number || '').trim();
    user.roleId = String(User_group || 'user').toLowerCase() === 'admin' ? adminRole._id : userRole._id;
    if (String(Password || '').trim()) {
      user.password = String(Password).trim();
    }
    await user.save();
    await user.populate('roleId');

    const accessToken = String(whatsapp?.accessToken || '').trim();
    const phoneNumberId = String(whatsapp?.phoneNumberId || '').trim();
    const businessAccountId = String(whatsapp?.businessAccountId || '').trim();
    const wabaId = String(whatsapp?.wabaId || businessAccountId).trim();

    let account = await WhatsAppAccount.findOne({ userId: user._id, isActive: true }).sort({ updatedAt: -1 });
    if (!account && phoneNumberId) {
      account = await WhatsAppAccount.findOne({ userId: user._id, phoneNumberId });
    }

    if (accessToken && phoneNumberId && (businessAccountId || wabaId)) {
      if (!account) {
        account = new WhatsAppAccount({
          userId: user._id,
          phoneNumberId,
          accessTokenEncrypted: encryptSensitiveValue(accessToken),
        });
      }
      account.connectionMode = 'manual';
      account.phoneNumberId = phoneNumberId;
      account.businessAccountId = businessAccountId || wabaId;
      account.wabaId = wabaId || businessAccountId;
      account.displayPhoneNumber = String(whatsapp?.displayPhoneNumber || account.displayPhoneNumber || '').trim();
      account.verifiedName = String(whatsapp?.verifiedName || account.verifiedName || '').trim();
      account.accessTokenEncrypted = encryptSensitiveValue(accessToken);
      account.tokenType = 'Bearer';
      account.status = 'active';
      account.webhookSubscribed = Boolean(whatsapp?.webhookSubscribed);
      account.isActive = true;
      account.lastSyncAt = new Date();
      account.metadata = {
        ...(account.metadata || {}),
        updatedByAdmin: true,
      };
      await WhatsAppAccount.updateMany({ userId: user._id, _id: { $ne: account._id } }, { $set: { isActive: false } });
      await account.save();
    }

    if (whatsapp?.clearAccount === true) {
      await WhatsAppAccount.deleteMany({ userId: user._id });
      account = null;
    }

    return res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      item: {
        ...sanitizeUser(user),
        whatsappAccount: sanitizeAccount(account),
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Self-service signup (mobile + WhatsApp OTP)
// ─────────────────────────────────────────────────────────────────────────

router.post('/signup/request-otp', async (req, res) => {
  const { User_name, Mobile_number } = req.body || {};
  const userName = String(User_name || '').trim();
  const mobile = String(Mobile_number || '').trim();

  if (!userName || !mobile) {
    return res.status(400).json({ success: false, message: 'User name and mobile number are required.' });
  }
  if (userName.toLowerCase() === RESERVED_USERNAME) {
    return res.status(400).json({ success: false, message: 'This username is reserved.' });
  }

  try {
    const existingUser = await User.findOne({ tenantId: null, $or: [{ username: userName }, { mobile }] });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this username or mobile number already exists.' });
    }

    const result = await sendOtp(mobile, 'SIGNUP');
    const success = result.sent || Boolean(result.devOtp);
    return res.status(success ? 200 : 502).json({
      success,
      message: result.sent
        ? 'OTP sent via WhatsApp.'
        : (result.devOtp
          ? `WhatsApp send failed (${result.error || 'unknown error'}); using dev OTP.`
          : (result.error || 'Could not send OTP via WhatsApp. Please try again later.')),
      devOtp: result.devOtp,
    });
  } catch (error) {
    console.error('Signup request-otp error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to send OTP.' });
  }
});

router.post('/signup/verify', async (req, res) => {
  const { User_name, Mobile_number, Password, code } = req.body || {};
  const userName = String(User_name || '').trim();
  const mobile = String(Mobile_number || '').trim();
  const password = String(Password || '').trim();
  const otpCode = String(code || '').trim();

  if (!userName || !mobile || !password || !otpCode) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const isValid = await verifyOtp(mobile, otpCode, 'SIGNUP');
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const existingUser = await User.findOne({ tenantId: null, $or: [{ username: userName }, { mobile }] });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this username or mobile number already exists.' });
    }

    const { userRole } = await getGlobalRoles();
    const user = await User.create({
      name: userName,
      username: userName,
      password,
      mobile,
      roleId: userRole._id,
      tenantId: null,
      isActive: true,
    });

    const token = signTokenForUser(user._id);

    return res.status(201).json({ success: true, token, user: sanitizeUser(await user.populate('roleId')) });
  } catch (error) {
    console.error('Signup verify error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create account.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Forgot password (mobile + WhatsApp OTP)
// ─────────────────────────────────────────────────────────────────────────

router.post('/forgot-password/request-otp', async (req, res) => {
  const mobile = String(req.body?.Mobile_number || '').trim();

  if (!mobile) {
    return res.status(400).json({ success: false, message: 'Mobile number is required.' });
  }

  try {
    const user = await User.findOne({ tenantId: null, mobile });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this mobile number.' });
    }

    const result = await sendOtp(mobile, 'RESET');
    const success = result.sent || Boolean(result.devOtp);
    return res.status(success ? 200 : 502).json({
      success,
      message: result.sent
        ? 'OTP sent via WhatsApp.'
        : (result.devOtp
          ? `WhatsApp send failed (${result.error || 'unknown error'}); using dev OTP.`
          : (result.error || 'Could not send OTP via WhatsApp. Please try again later.')),
      devOtp: result.devOtp,
    });
  } catch (error) {
    console.error('Forgot-password request-otp error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to send OTP.' });
  }
});

router.post('/forgot-password/reset', async (req, res) => {
  const mobile = String(req.body?.Mobile_number || '').trim();
  const otpCode = String(req.body?.code || '').trim();
  const newPassword = String(req.body?.newPassword || '').trim();

  if (!mobile || !otpCode || !newPassword) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const isValid = await verifyOtp(mobile, otpCode, 'RESET');
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const user = await User.findOne({ tenantId: null, mobile });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this mobile number.' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password reset successful. Please log in.' });
  } catch (error) {
    console.error('Forgot-password reset error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to reset password.' });
  }
});

module.exports = router;
