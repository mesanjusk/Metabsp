import { describe, expect, it, beforeAll, afterEach } from 'vitest';
import crypto from 'crypto';
import { encryptSensitiveValue, decryptSensitiveValue } from '@/lib/utils/crypto';

/**
 * Access tokens for every connected customer number are stored under this
 * encryption, so a regression here is a platform-wide outage or, worse, a
 * plaintext-at-rest disclosure.
 */
describe('utils/crypto — AES-256-GCM token encryption', () => {
  beforeAll(() => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  });

  afterEach(() => {
    delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS;
  });

  it('round-trips a value and tags it with the current key version', () => {
    const plaintext = 'EAABsbCS1234567890_test_access_token';
    const cipherText = encryptSensitiveValue(plaintext);

    expect(cipherText).not.toEqual(plaintext);
    const parts = cipherText.split(':');
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe('v2');
    expect(parts[1]).toBe('current');
    expect(decryptSensitiveValue(cipherText)).toBe(plaintext);
  });

  it('produces a different ciphertext each time, from a random IV', () => {
    const first = encryptSensitiveValue('same-input-both-times');
    const second = encryptSensitiveValue('same-input-both-times');

    expect(first).not.toEqual(second);
    expect(decryptSensitiveValue(first)).toBe(decryptSensitiveValue(second));
  });

  it('decrypts a value written under the previous key during a key rotation', () => {
    const rotatingOut = crypto.randomBytes(32).toString('base64');
    const original = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;

    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = rotatingOut;
    const cipherText = encryptSensitiveValue('written-before-the-rotation');

    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = original;
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS = rotatingOut;

    expect(decryptSensitiveValue(cipherText)).toBe('written-before-the-rotation');
  });

  it('refuses a tampered ciphertext rather than returning garbage', () => {
    const cipherText = encryptSensitiveValue('authentic');
    const parts = cipherText.split(':');
    // Flip a byte of the payload; GCM's auth tag must reject it.
    parts[4] = Buffer.from('tampered-payload').toString('base64');

    expect(() => decryptSensitiveValue(parts.join(':'))).toThrow();
  });

  it('throws when no encryption key is configured, instead of storing plaintext', () => {
    const original = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
    delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
    try {
      expect(() => encryptSensitiveValue('secret')).toThrow(/WHATSAPP_TOKEN_ENCRYPTION_KEY/);
    } finally {
      process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = original;
    }
  });
});
