import crypto from 'crypto';

// Ported unchanged from backend/src/utils/password.js — must match exactly
// since User.matchPassword() (lib/models/User.ts) falls back to this for
// legacy (pre-bcrypt) accounts shared with the always-on host.
const ITERATIONS = 16384;
const KEY_LENGTH = 64;
const HASH_PREFIX = 'scrypt';

function normalizePassword(value: unknown): string {
  return String(value || '');
}

export function isHashedPassword(value: unknown): boolean {
  return normalizePassword(value).startsWith(`${HASH_PREFIX}$`);
}

export function hashPassword(password: unknown): string {
  const plain = normalizePassword(password);
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plain, salt, KEY_LENGTH, { N: ITERATIONS }).toString('hex');
  return `${HASH_PREFIX}$${salt}$${derivedKey}`;
}

export function verifyPassword(password: unknown, storedHash: unknown): boolean {
  const plain = normalizePassword(password);
  const serialized = normalizePassword(storedHash);

  if (!isHashedPassword(serialized)) {
    return plain === serialized;
  }

  const [, salt, expectedKey] = serialized.split('$');
  if (!salt || !expectedKey) return false;

  const actualKey = crypto.scryptSync(plain, salt, KEY_LENGTH, { N: ITERATIONS }).toString('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(actualKey, 'hex'), Buffer.from(expectedKey, 'hex'));
  } catch (_error) {
    return false;
  }
}
