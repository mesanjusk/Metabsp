import { describe, expect, it } from 'vitest';
// Plain CommonJS, because next.config.js consumes it before any compilation.
const { securityHeaders, CONTENT_SECURITY_POLICY } = require('../lib/http/securityHeaders');

const header = (key: string) =>
  securityHeaders.find((entry: any) => entry.key.toLowerCase() === key.toLowerCase())?.value;

describe('security response headers', () => {
  it('sets every header the Express app got from helmet and the Next port had lost', () => {
    expect(header('Strict-Transport-Security')).toMatch(/max-age=\d+/);
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('Permissions-Policy')).toContain('camera=()');
    expect(header('Content-Security-Policy')).toBeTruthy();
  });

  it('forbids framing in both the modern and the legacy mechanism', () => {
    // A session token in localStorage makes clickjacking a real path to
    // account takeover, so both must be present.
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(header('X-Frame-Options')).toBe('DENY');
  });

  it('allows Meta\'s SDK to load, since Embedded Signup cannot run without it', () => {
    expect(CONTENT_SECURITY_POLICY).toContain('https://connect.facebook.net');
    expect(CONTENT_SECURITY_POLICY).toContain('frame-src');
    expect(CONTENT_SECURITY_POLICY).toContain('https://www.facebook.com');
  });

  it('blocks plugins and restricts form targets and the base URI', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("form-action 'self'");
  });

  it('does not allow script from an arbitrary origin', () => {
    const scriptSrc = CONTENT_SECURITY_POLICY.split('; ').find((d: string) => d.startsWith('script-src'));
    expect(scriptSrc).not.toContain('*');
    expect(scriptSrc).not.toContain('http:');
  });
});
