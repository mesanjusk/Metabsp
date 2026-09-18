import { describe, expect, it } from 'vitest';
import { sanitizeReviewReply } from '@/lib/googleBusiness/ai';

describe('Google review reply guardrails', () => {
  it('strips formatting and enforces the 250 character cap', () => {
    const input = '<b>**Thanks**</b> ' + 'x'.repeat(400);
    const result = sanitizeReviewReply(input, false);
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('*');
    expect(result.length).toBeLessThanOrEqual(250);
  });

  it('removes emoji unless the tenant permits them', () => {
    expect(sanitizeReviewReply('Thank you 😊', false)).toBe('Thank you');
    expect(sanitizeReviewReply('Thank you 😊', true)).toContain('😊');
  });
});
