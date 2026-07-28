import AppError from '../utils/AppError';
import { decryptSensitiveValue } from '../utils/crypto';
import { getGraphApiVersion as graphVersion } from '../config/graphApi';
import WhatsAppAccount from '../models/WhatsAppAccount';
import User from '../models/User';

// Ported from backend/src/services/whatsappAccountService.js.

export const sanitizeAccount = (accountDoc: any) => {
  if (!accountDoc) return null;
  const account = typeof accountDoc.toObject === 'function' ? accountDoc.toObject() : { ...accountDoc };
  delete account.accessTokenEncrypted;
  delete account.accessToken;
  return account;
};

export const resolveLegacyEnvConfig = () => {
  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  if (!accessToken || !phoneNumberId) return null;

  const wabaId = String(
    process.env.WHATSAPP_WABA_ID || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.WABA_ID || ''
  ).trim();
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

const toAccountContext = (account: any) => {
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

export const loadActiveWhatsAppAccountForUser = async (userId: string, options: { requireAccount?: boolean } = {}) => {
  const { requireAccount = true } = options;

  let account: any = await WhatsAppAccount.findOne({ userId, isActive: true, status: { $ne: 'disconnected' } })
    .sort({ updatedAt: -1 })
    .lean();

  if (!account) {
    account = await WhatsAppAccount.findOne({ userId, status: { $ne: 'disconnected' } }).sort({ updatedAt: -1 }).lean();
  }

  if (!account) {
    account = await WhatsAppAccount.findOne({ teamMemberIds: userId, status: { $ne: 'disconnected' } })
      .sort({ updatedAt: -1 })
      .lean();
  }

  if (!account) {
    if (!requireAccount) return null;

    const user: any = await User.findById(userId).select('eventDutyType').lean();
    if (user?.eventDutyType === 'SUPER_ADMIN') {
      const legacyConfig = resolveLegacyEnvConfig();
      if (legacyConfig) return legacyConfig;
    }

    throw new AppError('No active WhatsApp account connected', 404);
  }

  return toAccountContext(account);
};

export const loadWhatsAppAccountByPhoneNumberId = async (phoneNumberId: string, options: { requireAccount?: boolean } = {}) => {
  const { requireAccount = true } = options;
  if (!phoneNumberId) {
    if (!requireAccount) return null;
    throw new AppError('phoneNumberId is required', 400);
  }

  const account: any = await WhatsAppAccount.findOne({
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

export const assertPhoneNumberAvailable = async ({
  phoneNumberId,
  userId,
  excludeAccountId,
}: {
  phoneNumberId: string;
  userId?: string;
  excludeAccountId?: string;
}) => {
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

const normalizeDigits = (value: unknown) => String(value || '').replace(/\D/g, '');

export const loadWhatsAppAccountFromWebhookIdentifiers = async (
  { phoneNumberId, wabaId, businessAccountId, displayPhoneNumber }: any = {},
  options: { requireAccount?: boolean } = {}
) => {
  const { requireAccount = true } = options;
  const normalizedPhoneNumberId = String(phoneNumberId || '').trim();
  const normalizedWabaId = String(wabaId || '').trim();
  const normalizedBusinessAccountId = String(businessAccountId || '').trim();

  let account: any = null;
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
    const candidates: any[] = await WhatsAppAccount.find({ status: { $ne: 'disconnected' } })
      .sort({ isActive: -1, updatedAt: -1 })
      .limit(100)
      .lean();
    account = candidates.find((item) => normalizeDigits(item.displayPhoneNumber) === normalizedDisplayPhone) || null;
  }

  if (!account) {
    if (!requireAccount) return null;
    throw new AppError('No WhatsApp account matched for webhook payload', 404);
  }

  return toAccountContext(account);
};

export const loadAccountContextById = async (accountId: string) => {
  const account = await WhatsAppAccount.findById(accountId);
  if (!account) throw new AppError('WhatsApp account not found', 404);
  return toAccountContext(account);
};
