import { describe, expect, it } from 'vitest';
// Plain CommonJS, because next.config.js consumes it before any compilation.
const { securityHeaders, buildCsp } = require('../lib/http/securityHeaders');

const header = (key: string) =>
  securityHeaders.find((entry: any) => entry.key.toLowerCase() === key.toLowerCase())?.value;

const NONCE = 'test-nonce-value';
const directives = (csp: string) =>
  Object.fromEntries(
    csp.split('; ').map((directive) => {
      const [name, ...values] = directive.split(' ');
      return [name, values.join(' ')];
    })
  );

describe('static security response headers', () => {
  it('sets every header the Express app got from helmet and the Next port had lost', () => {
    expect(header('Strict-Transport-Security')).toMatch(/max-age=\d+/);
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('Permissions-Policy')).toContain('camera=()');
  });

  it('does not set the CSP statically — it carries a per-request nonce', () => {
    expect(header('Content-Security-Policy')).toBeUndefined();
  });

  it('allows popups through COOP, because Embedded Signup is one', () => {
    expect(header('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups');
  });
});

describe('per-request Content-Security-Policy', () => {
  it('binds scripts to the request nonce rather than allowing inline script', () => {
    const scriptSrc = directives(buildCsp(NONCE, { isDev: false }))['script-src'];

    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    // strict-dynamic is what makes a CSP3 browser ignore the 'unsafe-inline'
    // and host entries that remain only as legacy-browser fallback.
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it('embeds the nonce it is given, so two requests cannot share a policy', () => {
    expect(buildCsp('aaa', { isDev: false })).toContain("'nonce-aaa'");
    expect(buildCsp('bbb', { isDev: false })).toContain("'nonce-bbb'");
    expect(buildCsp('aaa', { isDev: false })).not.toContain("'nonce-bbb'");
  });

  it('keeps unsafe-eval out of production', () => {
    expect(buildCsp(NONCE, { isDev: false })).not.toContain("'unsafe-eval'");
    expect(buildCsp(NONCE, { isDev: true })).toContain("'unsafe-eval'");
  });

  it('forbids framing in both the modern and the legacy mechanism', () => {
    // A session token in localStorage makes clickjacking a real path to
    // account takeover, so both must be present.
    expect(buildCsp(NONCE)).toContain("frame-ancestors 'none'");
    expect(header('X-Frame-Options')).toBe('DENY');
  });

  it("allows Meta's SDK to load, since Embedded Signup cannot run without it", () => {
    const csp = buildCsp(NONCE);
    expect(csp).toContain('https://connect.facebook.net');
    expect(directives(csp)['frame-src']).toContain('https://www.facebook.com');
  });

  it('blocks plugins and restricts form targets and the base URI', () => {
    const csp = buildCsp(NONCE);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it('never allows script from a wildcard or plaintext origin', () => {
    const scriptSrc = directives(buildCsp(NONCE, { isDev: false }))['script-src'];
    expect(scriptSrc).not.toContain('*');
    expect(scriptSrc).not.toContain('http:');
  });
});
