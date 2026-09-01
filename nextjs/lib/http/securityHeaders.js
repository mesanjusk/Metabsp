/**
 * Security response headers.
 *
 * Plain CommonJS because next.config.js consumes it, and that file is loaded
 * by Node before any compilation step exists.
 *
 * The Express app got these from `helmet()`. Next has no equivalent, so the
 * port shipped with none of them: no HSTS, no clickjacking protection, no
 * MIME-sniffing protection and no CSP. Every one of those is something a
 * security reviewer checks first, and two of them (framing and CSP) are what
 * stand between a single injected script and a session token in localStorage.
 *
 * The Content-Security-Policy is NOT set here. It is built per request in
 * middleware.ts, because it carries a per-request nonce — see buildCsp below.
 * Everything in this file is the same on every response.
 */

// Hosts the product genuinely needs. Anything not listed is blocked, which is
// the point — keep this list short and justified rather than convenient.
const META_SDK = 'https://connect.facebook.net';
const META_FRAMES = 'https://www.facebook.com https://web.facebook.com https://business.facebook.com';
const META_API = 'https://graph.facebook.com https://www.facebook.com';
const CLOUDINARY = 'https://res.cloudinary.com https://api.cloudinary.com';

/**
 * Builds the policy for one request.
 *
 * The script directive is nonce-based with `'strict-dynamic'`, which is the
 * meaningful part. Previously it carried `'unsafe-inline'`, because Next
 * inlines its own hydration bootstrap into every document and the only way
 * around that is a per-request nonce — which in turn forces every page to
 * render dynamically. That trade was worth taking here: the app runs as a
 * persistent Node process rather than as functions, so per-request rendering
 * costs little, and `'unsafe-inline'` is precisely the allowance that makes a
 * CSP decorative against injected script.
 *
 * `'strict-dynamic'` means a modern browser ignores `'unsafe-inline'` and the
 * host allow-list in script-src entirely and trusts only the nonce and what
 * nonced script loads. The two are kept alongside it as the documented
 * graceful degradation for browsers that predate CSP Level 3 — in a CSP3
 * browser they have no effect at all.
 *
 * `'unsafe-inline'` in style-src is not optional: Emotion, which MUI is built
 * on, injects component styles as inline <style> elements at runtime.
 */
function buildCsp(nonce, { isDev = process.env.NODE_ENV !== 'production' } = {}) {
  // Next's dev server compiles and evaluates modules in the browser, which
  // needs 'unsafe-eval'. Production never does.
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Ignored by CSP3 browsers because of strict-dynamic; kept for older ones.
    "'unsafe-inline'",
    META_SDK,
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(' ');

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src 'self' data: blob: ${CLOUDINARY} https://*.fbcdn.net https://scontent.whatsapp.net`,
    `connect-src 'self' ws: wss: ${META_API} ${CLOUDINARY}`,
    `frame-src 'self' ${META_FRAMES}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Belt and braces with X-Frame-Options below: frame-ancestors is what
    // modern browsers honour, the header is for the rest.
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

const securityHeaders = [
  // Two years, preload-eligible. Safe because the product is HTTPS-only
  // everywhere it is served from.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing in a messaging dashboard needs any of these.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // Meta's Embedded Signup runs in a popup that talks back to the opener, so
  // this cannot be plain same-origin.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
];

module.exports = { securityHeaders, buildCsp };
