const { hashPassword, isHashedPassword, verifyPassword } = require('../src/utils/password');

describe('password utils', () => {
  it('hashes a password with the scrypt$salt$key format', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
  });

  it('produces a different hash (different salt) for the same password', () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    expect(a).not.toBe(b);
  });

  it('verifies a correct password against its hash', () => {
    const hash = hashPassword('my-password');
    expect(verifyPassword('my-password', hash)).toBe(true);
  });

  it('rejects an incorrect password against a hash', () => {
    const hash = hashPassword('my-password');
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('falls back to plaintext comparison for legacy unhashed values', () => {
    expect(verifyPassword('legacy-plain', 'legacy-plain')).toBe(true);
    expect(verifyPassword('other', 'legacy-plain')).toBe(false);
  });

  it('identifies hashed vs. plaintext values', () => {
    expect(isHashedPassword(hashPassword('x'))).toBe(true);
    expect(isHashedPassword('plaintext')).toBe(false);
  });

  it('returns false for a malformed hash missing salt/key', () => {
    expect(verifyPassword('anything', 'scrypt$onlysalt')).toBe(false);
  });
});
