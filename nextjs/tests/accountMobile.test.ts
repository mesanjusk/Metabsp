import { describe, it, expect } from 'vitest';
import {
  normalizeAccountMobile,
  mobileLookupCandidates,
  isPlausibleMobile,
} from '../lib/utils/accountMobile';

describe('normalizeAccountMobile', () => {
  it('reduces the ways one number can be typed to a single identity', () => {
    const canonical = '919876543210';
    for (const typed of [
      '9876543210',
      '919876543210',
      '+91 98765 43210',
      '+91-98765-43210',
      '  919876543210  ',
      '0091 9876543210',
    ]) {
      expect(normalizeAccountMobile(typed)).toBe(canonical);
    }
  });

  it('leaves a number that already carries another country code alone', () => {
    // 11 digits, US +1 — the 10-digit India rule must not fire.
    expect(normalizeAccountMobile('+1 415 555 0134')).toBe('14155550134');
    expect(normalizeAccountMobile('442071838750')).toBe('442071838750');
  });

  it('is empty for input that holds no digits, so it can never be a silent match', () => {
    expect(normalizeAccountMobile('')).toBe('');
    expect(normalizeAccountMobile(null)).toBe('');
    expect(normalizeAccountMobile('admin')).toBe('');
  });
});

describe('mobileLookupCandidates', () => {
  it('finds an account stored without a country code from a number typed with one', () => {
    // The case that would otherwise lock out everyone who registered before
    // the number became the identity.
    expect(mobileLookupCandidates('+91 98765 43210')).toContain('9876543210');
    expect(mobileLookupCandidates('+91 98765 43210')).toContain('919876543210');
  });

  it('finds an account stored with a country code from a bare 10-digit number', () => {
    expect(mobileLookupCandidates('9876543210')).toContain('919876543210');
  });

  it('never yields an empty candidate, which would match every blank mobile field', () => {
    for (const input of ['', '   ', null, undefined, 'admin']) {
      expect(mobileLookupCandidates(input as any).every((value) => value.length > 0)).toBe(true);
    }
  });

  it('keeps a legacy username lookup possible by preserving the raw input', () => {
    expect(mobileLookupCandidates('admin')).toEqual(['admin']);
  });
});

describe('isPlausibleMobile', () => {
  it('accepts real numbers and rejects what would waste an OTP', () => {
    expect(isPlausibleMobile('9876543210')).toBe(true);
    expect(isPlausibleMobile('+1 415 555 0134')).toBe(true);
    expect(isPlausibleMobile('12345')).toBe(false);
    expect(isPlausibleMobile('')).toBe(false);
    expect(isPlausibleMobile('9'.repeat(20))).toBe(false);
  });
});
