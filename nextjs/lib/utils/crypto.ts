import crypto from 'crypto';
import { AppError } from './AppError';

// Ported unchanged from backend/src/utils/crypto.js (the LIVE copy — see
// docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md §1.2: backend/utils/crypto.js is a
// dead, orphaned duplicate, deliberately not ported here). Must use the
// SAME WHATSAPP_TOKEN_ENCRYPTION_KEY(_PREVIOUS) as the always-on host —
// WhatsAppAccount.accessTokenEncrypted values are shared between both apps.
const ALGORITHM = 'aes-256-gcm';

const parseKey = (raw: string | undefined, label: string): Buffer | null => {
  if (!raw) return null;
  const bufferKey = Buffer.from(raw, 'base64');
  if (bufferKey.length !== 32) {
    throw new AppError(`${label} must be a base64-encoded 32-byte key`, 500);
  }
  return bufferKey;
};

const getKeys = () => {
  const current = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!current) throw new AppError('WHATSAPP_TOKEN_ENCRYPTION_KEY is missing', 500);

  return {
    current: parseKey(current, 'WHATSAPP_TOKEN_ENCRYPTION_KEY') as Buffer,
    previous: parseKey(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS, 'WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS'),
  };
};

export const encryptSensitiveValue = (value: unknown): string => {
  const { current } = getKeys();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, current, iv);
  const encrypted = Buffer.concat([cipher.update(String(value || ''), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v2:current:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
};

const runDecipher = (key: Buffer, ivPart: string, authTagPart: string, encryptedPart: string): string => {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, 'base64')), decipher.final()]).toString('utf8');
};

export const decryptSensitiveValue = (cipherText: unknown): string => {
  const parts = String(cipherText || '').split(':');
  const { current, previous } = getKeys();

  if (parts.length === 5 && parts[0] === 'v2') {
    const [, keyLabel, ivPart, authTagPart, encryptedPart] = parts;
    const labelled = keyLabel === 'previous' ? previous : current;
    if (!labelled) throw new AppError(`No encryption key available for label "${keyLabel}"`, 500);

    try {
      return runDecipher(labelled, ivPart, authTagPart, encryptedPart);
    } catch (error) {
      // The label records which key was current AT THE TIME OF WRITING, and
      // encryptSensitiveValue always writes "current" — so the moment
      // WHATSAPP_TOKEN_ENCRYPTION_KEY is rotated, every value already in the
      // database still claims "current" while meaning the outgoing key.
      // Without this fallback a rotation silently invalidates every stored
      // access token: each connected number stops sending, and the only
      // recovery is re-onboarding every customer. Rotation is supposed to be
      // the safe operation, so a labelled-key failure retries the other key
      // before giving up. The 3-part legacy branch below always worked this
      // way; the v2 branch did not.
      const fallback = keyLabel === 'previous' ? current : previous;
      if (fallback) return runDecipher(fallback, ivPart, authTagPart, encryptedPart);
      throw error;
    }
  }

  if (parts.length === 3) {
    const [ivPart, authTagPart, encryptedPart] = parts;
    try {
      return runDecipher(current, ivPart, authTagPart, encryptedPart);
    } catch (error) {
      if (previous) return runDecipher(previous, ivPart, authTagPart, encryptedPart);
      throw error;
    }
  }

  throw new AppError('Invalid encrypted token format', 500);
};

export const encrypt = encryptSensitiveValue;
export const decrypt = decryptSensitiveValue;
