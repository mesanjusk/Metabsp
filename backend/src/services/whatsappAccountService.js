const WhatsAppAccount = require('../repositories/whatsappAccount');
const AppError = require('../utils/AppError');
const { decryptSensitiveValue } = require('../utils/crypto');
const { getGraphApiVersion: graphVersion } = require('../config/graphApi');

const sanitizeAccount = (accountDoc) => {
  if (!accountDoc) return null;
  const account = typeof accountDoc.toObject === 'function' ? accountDoc.toObject() : { ...accountDoc };
  delete account.accessTokenEncrypted;
  delete account.accessToken;
  return account;
};

const resolveLegacyEnvConfig = () => {
  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  if (!accessToken || !phoneNumberId) return null;

  const wabaId = String(process.env.WHATSAPP_WABA_ID || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.WABA_ID || '').trim();
  const businessAccountId = String(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim();

  return {
    source: 'legacy-env',
    connectionMode: 'legacy_env',
    graphVersion: graphVersion(),
    accessToken,
    phoneNumberId,
    wabaId,
    businessAccountId,
    verifiedName: '',
    displayPhoneNumber: phoneNumberId,
    status: 'active',
    webhookSubscribed: false,
  };
};

const toAccountContext = (account) => {
  let accessToken = '';

  if (account.accessTokenEncrypted) {
    try {
      accessToken = decryptSensitiveValue(account.accessTokenEncrypted);
    } catch (_error) {
      throw new AppError('Connected WhatsApp account token is invalid', 500);
    }
  } else if (account.accessToken) {
    accessToken = String(account.accessToken);
  }

  return {
    source: 'database',
    graphVersion: graphVersion(),
    accessToken,
    phoneNumberId: String(account.phoneNumberId || ''),
    wabaId: String(account.wabaId || ''),
    businessAccountId: String(account.businessAccountId || ''),
    verifiedName: String(account.verifiedName || ''),
    displayPhoneNumber: String(account.displayPhoneNumber || ''),
    status: account.status,
    webhookSubscribed: Boolean(account.webhookSubscribed),
    account,
  };
};

const loadActiveWhatsAppAccountForUser = async (userId, options = {}) => {
  const { requireAccount = true } = options;

  let account = await WhatsAppAccount.findOne({ userId, isActive: true, status: { $ne: 'disconnected' } })
    .sort({ updatedAt: -1 })
    .lean();

  if (!account) {
    account = await WhatsAppAccount.findOne({ userId, status: { $ne: 'disconnected' } }).sort({ updatedAt: -1 }).lean();
  }

  if (!account) {
    // No legacy-env fallback here: that config is the platform's own number
    // (see otpService.js, which uses resolveLegacyEnvConfig directly for
    // signup/reset OTPs). A logged-in user's own send/status/template calls
    // must never silently borrow it — surface "connect your own number" instead.
    if (!requireAccount) return null;
    throw new AppError('No active WhatsApp account connected', 404);
  }

  return toAccountContext(account);
};

const loadWhatsAppAccountByPhoneNumberId = async (phoneNumberId, options = {}) => {
  const { requireAccount = true } = options;
  if (!phoneNumberId) {
    if (!requireAccount) return null;
    throw new AppError('phoneNumberId is required', 400);
  }

  const account = await WhatsAppAccount.findOne({
    phoneNumberId: String(phoneNumberId),
    status: { $ne: 'disconnected' },
  })
    .sort({ isActive: -1, updatedAt: -1 })
    .lean();

  if (!account) {
    if (!requireAccount) return null;
    throw new AppError('No WhatsApp account matched for phone number', 404);
  }

  return toAccountContext(account);
};

// Rejects connecting a phoneNumberId that another user already holds, so the
// shared webhook's routing-by-phoneNumberId can never become ambiguous
// between two tenants. Backed by the partial unique index on phoneNumberId
// in repositories/whatsappAccount.js — this check just gives a clean error
// instead of a raw duplicate-key failure.
const assertPhoneNumberAvailable = async ({ phoneNumberId, userId, excludeAccountId } = {}) => {
  const conflict = await WhatsAppAccount.findOne({
    phoneNumberId: String(phoneNumberId || ''),
    userId: { $ne: userId },
    numberClaimed: true,
    ...(excludeAccountId ? { _id: { $ne: excludeAccountId } } : {}),
  }).lean();

  if (conflict) {
    throw new AppError('This WhatsApp number is already connected to a different account.', 409);
  }
};

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

const loadWhatsAppAccountFromWebhookIdentifiers = async (
  { phoneNumberId, wabaId, businessAccountId, displayPhoneNumber } = {},
  options = {}
) => {
  const { requireAccount = true } = options;
  const normalizedPhoneNumberId = String(phoneNumberId || '').trim();
  const normalizedWabaId = String(wabaId || '').trim();
  const normalizedBusinessAccountId = String(businessAccountId || '').trim();

  let account = null;
  if (normalizedPhoneNumberId) {
    account = await WhatsAppAccount.findOne({
      phoneNumberId: normalizedPhoneNumberId,
      status: { $ne: 'disconnected' },
    })
      .sort({ isActive: -1, updatedAt: -1 })
      .lean();
  }

  if (!account && (normalizedWabaId || normalizedBusinessAccountId)) {
    account = await WhatsAppAccount.findOne({
      status: { $ne: 'disconnected' },
      $or: [
        ...(normalizedWabaId ? [{ wabaId: normalizedWabaId }] : []),
        ...(normalizedBusinessAccountId ? [{ businessAccountId: normalizedBusinessAccountId }] : []),
      ],
    })
      .sort({ isActive: -1, updatedAt: -1 })
      .lean();
  }

  const normalizedDisplayPhone = normalizeDigits(displayPhoneNumber);
  if (!account && normalizedDisplayPhone) {
    const candidates = await WhatsAppAccount.find({ status: { $ne: 'disconnected' } })
      .sort({ isActive: -1, updatedAt: -1 })
      .limit(100)
      .lean();
    account = candidates.find((item) => normalizeDigits(item.displayPhoneNumber) === normalizedDisplayPhone) || null;
  }

  // No "if only one account exists system-wide, assume it's theirs" fallback
  // here on purpose: with phoneNumberId now globally unique per claim, a
  // payload that fails to match by identifier is genuinely unattributable —
  // guessing would risk forwarding one tenant's message to another tenant's
  // webhook destinations.
  if (!account) {
    if (!requireAccount) return null;
    throw new AppError('No WhatsApp account matched for webhook payload', 404);
  }

  return toAccountContext(account);
};

const resolveCurrentWhatsAppAccount = async (req, options = {}) => {
  if (!req.user?.id) throw new AppError('Unauthorized', 401);
  const resolved = await loadActiveWhatsAppAccountForUser(req.user.id, options);
  req.whatsappAccountContext = resolved;
  return resolved;
};

const resolveActiveWhatsAppAccount = async (userId, options = {}) =>
  loadActiveWhatsAppAccountForUser(userId, options);

module.exports = {
  sanitizeAccount,
  resolveLegacyEnvConfig,
  loadActiveWhatsAppAccountForUser,
  resolveActiveWhatsAppAccount,
  loadWhatsAppAccountByPhoneNumberId,
  loadWhatsAppAccountFromWebhookIdentifiers,
  resolveCurrentWhatsAppAccount,
  assertPhoneNumberAvailable,
};
