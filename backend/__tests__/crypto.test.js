const crypto = require('crypto');

describe('utils/crypto (AES-256-GCM token encryption)', () => {
  const originalKey = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  const originalPreviousKey = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS;

  beforeAll(() => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  });

  afterAll(() => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = originalKey;
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS = originalPreviousKey;
  });

  afterEach(() => {
    delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS;
  });

  // Re-require inside each test after env var mutation, since the module
  // reads process.env lazily inside functions rather than at load time.
  const { encryptSensitiveValue, decryptSensitiveValue } = require('../src/utils/crypto');

  it('round-trips a plaintext value through encrypt then decrypt, tagged with the current key version', () => {
    const plaintext = 'EAABsbCS1234567890_test_access_token';
    const cipherText = encryptSensitiveValue(plaintext);

    expect(cipherText).not.toEqual(plaintext);
    const parts = cipherText.split(':');
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe('v2');
    expect(parts[1]).toBe('current');
    expect(decryptSensitiveValue(cipherText)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const plaintext = 'same-input-both-times';
    const first = encryptSensitiveValue(plaintext);
    const second = encryptSensitiveValue(plaintext);

    expect(first).not.toEqual(second);
    expect(decryptSensitiveValue(first)).toBe(plaintext);
    expect(decryptSensitiveValue(second)).toBe(plaintext);
  });

  it('throws on a malformed ciphertext instead of returning garbage', () => {
    expect(() => decryptSensitiveValue('not-a-valid-ciphertext')).toThrow();
  });

  it('throws when the auth tag has been tampered with', () => {
    const cipherText = encryptSensitiveValue('tamper-test');
    const [v, label, iv, authTag, body] = cipherText.split(':');
    const tamperedBody = Buffer.from(body, 'base64');
    tamperedBody[0] ^= 0xff;
    const tampered = `${v}:${label}:${iv}:${authTag}:${tamperedBody.toString('base64')}`;

    expect(() => decryptSensitiveValue(tampered)).toThrow();
  });

  describe('key rotation', () => {
    it('decrypts legacy (pre-rotation) 3-part ciphertext with the current key when no previous key is configured', () => {
      // Reconstruct what encryptSensitiveValue produced before key
      // versioning existed: iv:authTag:encrypted, no label.
      const algorithm = 'aes-256-gcm';
      const key = Buffer.from(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY, 'base64');
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      const encrypted = Buffer.concat([cipher.update('legacy-plaintext', 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const legacyCipherText = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;

      expect(decryptSensitiveValue(legacyCipherText)).toBe('legacy-plaintext');
    });

    it('decrypts a legacy ciphertext encrypted under a since-rotated-out key via the previous-key fallback', () => {
      const oldKey = crypto.randomBytes(32).toString('base64');
      const newKey = crypto.randomBytes(32).toString('base64');

      process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = oldKey;
      delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS;
      jest.resetModules();
      const { encryptSensitiveValue: encryptUnderOldScheme } = require('../src/utils/crypto');

      // Simulate a legacy (pre-rotation) value by stripping this module's
      // v2 label back down to the old 3-part shape.
      const cipherWithLabel = encryptUnderOldScheme('rotated-secret');
      const [, , iv, authTag, encrypted] = cipherWithLabel.split(':');
      const legacyShapedCipherText = `${iv}:${authTag}:${encrypted}`;

      // Now rotate: new key becomes current, old key becomes previous.
      process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = newKey;
      process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS = oldKey;
      jest.resetModules();
      const { decryptSensitiveValue: decryptAfterRotation } = require('../src/utils/crypto');

      expect(decryptAfterRotation(legacyShapedCipherText)).toBe('rotated-secret');
    });

    it('decrypts a v2 ciphertext explicitly labeled "previous" using the previous key', () => {
      const oldKey = crypto.randomBytes(32).toString('base64');
      const newKey = crypto.randomBytes(32).toString('base64');

      process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = oldKey;
      delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS;
      jest.resetModules();
      const { encryptSensitiveValue: encryptUnderOldKey } = require('../src/utils/crypto');
      const cipherUnderOldKey = encryptUnderOldKey('previous-labeled-secret');
      const relabeledAsPrevious = cipherUnderOldKey.replace(':current:', ':previous:');

      process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = newKey;
      process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS = oldKey;
      jest.resetModules();
      const { decryptSensitiveValue: decryptAfterRotation } = require('../src/utils/crypto');

      expect(decryptAfterRotation(relabeledAsPrevious)).toBe('previous-labeled-secret');
    });

    it('throws when a "previous"-labeled ciphertext is decrypted with no previous key configured', () => {
      const cipherText = encryptSensitiveValue('no-previous-key-configured');
      const relabeled = cipherText.replace(':current:', ':previous:');

      expect(() => decryptSensitiveValue(relabeled)).toThrow(/No encryption key available/);
    });
  });
});
