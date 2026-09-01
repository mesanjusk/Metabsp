import { describe, expect, it } from 'vitest';
import { hashPassword, isHashedPassword, verifyPassword } from '@/lib/utils/password';

describe('utils/password — legacy scrypt compatibility', () => {
  it('hashes to a salted, prefixed value that is not the plaintext', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(hash).not.toContain('correct horse');
    expect(isHashedPassword(hash)).toBe(true);
    expect(hash.split('$')).toHaveLength(3);
  });

  it('salts, so the same password hashes differently every time', () => {
    expect(hashPassword('same')).not.toEqual(hashPassword('same'));
  });

  it('verifies a correct password and rejects a wrong one', () => {
    const hash = hashPassword('s3cret-value');
    expect(verifyPassword('s3cret-value', hash)).toBe(true);
    expect(verifyPassword('s3cret-valuf', hash)).toBe(false);
    expect(verifyPassword('', hash)).toBe(false);
  });

  it('does not treat an unhashed stored value as a hash', () => {
    expect(isHashedPassword('plaintext-password')).toBe(false);
    expect(isHashedPassword('')).toBe(false);
  });
});
