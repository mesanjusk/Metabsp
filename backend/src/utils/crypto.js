const crypto = require('crypto');
const AppError = require('./AppError');

const ALGORITHM = 'aes-256-gcm';

const parseKey = (raw, label) => {
  if (!raw) return null;
  const bufferKey = Buffer.from(raw, 'base64');
  if (bufferKey.length !== 32) {
    throw new AppError(`${label} must be a base64-encoded 32-byte key`, 500);
  }
  return bufferKey;
};

// Supports zero-downtime encryption key rotation: generate a new key, set it
// as WHATSAPP_TOKEN_ENCRYPTION_KEY, and move the old value to
// WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS before deploying. New values are
// always encrypted with the current key; anything already encrypted with
// the previous key — including legacy ciphertext from before this rotation
// scheme existed, which carries no key label at all — still decrypts
// correctly. Once every stored value has been re-encrypted (naturally
// happens for WhatsApp tokens as tokenRefreshService.js cycles them, or via
// a one-off re-encryption pass), WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS can
// be dropped.
const getKeys = () => {
  const current = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!current) throw new AppError('WHATSAPP_TOKEN_ENCRYPTION_KEY is missing', 500);

  return {
    current: parseKey(current, 'WHATSAPP_TOKEN_ENCRYPTION_KEY'),
    previous: parseKey(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS, 'WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS'),
  };
};

const encryptSensitiveValue = (value) => {
  const { current } = getKeys();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, current, iv);
  const encrypted = Buffer.concat([cipher.update(String(value || ''), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v2:current:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
};

const runDecipher = (key, ivPart, authTagPart, encryptedPart) => {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, 'base64')), decipher.final()]).toString('utf8');
};

const decryptSensitiveValue = (cipherText) => {
  const parts = String(cipherText || '').split(':');
  const { current, previous } = getKeys();

  if (parts.length === 5 && parts[0] === 'v2') {
    const [, keyLabel, ivPart, authTagPart, encryptedPart] = parts;
    const key = keyLabel === 'previous' ? previous : current;
    if (!key) throw new AppError(`No encryption key available for label "${keyLabel}"`, 500);
    return runDecipher(key, ivPart, authTagPart, encryptedPart);
  }

  if (parts.length === 3) {
    // Legacy format, predates key rotation — try the current key first
    // (matches the original single-key behavior exactly when no rotation
    // has ever happened), falling back to the previous key only if a
    // rotation has since occurred and this value hasn't been re-encrypted.
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

const encrypt = encryptSensitiveValue;
const decrypt = decryptSensitiveValue;

module.exports = { encrypt, decrypt, encryptSensitiveValue, decryptSensitiveValue };
