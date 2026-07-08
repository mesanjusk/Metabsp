const crypto = require('crypto');

describe('utils/crypto (AES-256-GCM token encryption)', () => {
  const originalKey = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  });

  afterAll(() => {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = originalKey;
  });

  // Re-require inside each test after env var mutation, since the module
  // reads process.env lazily inside functions rather than at load time.
  const { encryptSensitiveValue, decryptSensitiveValue } = require('../src/utils/crypto');

  it('round-trips a plaintext value through encrypt then decrypt', () => {
    const plaintext = 'EAABsbCS1234567890_test_access_token';
    const cipherText = encryptSensitiveValue(plaintext);

    expect(cipherText).not.toEqual(plaintext);
    expect(cipherText.split(':')).toHaveLength(3);
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
    const [iv, authTag, body] = cipherText.split(':');
    const tamperedBody = Buffer.from(body, 'base64');
    tamperedBody[0] ^= 0xff;
    const tampered = `${iv}:${authTag}:${tamperedBody.toString('base64')}`;

    expect(() => decryptSensitiveValue(tampered)).toThrow();
  });
});
