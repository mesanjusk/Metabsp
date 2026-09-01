/**
 * Security response headers.
 *
 * Plain CommonJS because next.config.js consumes it, and that file is loaded
 * by Node before any compilation step exists.
 *
 * The Express app got these from `helmet()`. Next has no equivalent, so until
 * now the app shipped with none of them: no HSTS, no clickjacking protection,
 * no MIME-sniffing protection and no CSP. Every one of those is something a
 * security reviewer looks for first, and two of them (framing and CSP) are
 * what stand between a single injected script and a session token that lives
 * in localStorage.
 */

// Hosts the product genuinely needs. Anything not listed is blocked, which is
// the whole point — keep this list short and justified rather than convenient.
const META_SDK = 'https://connect.facebook.net';
const META_FRAMES = 'https://www.facebook.com https://web.facebook.com https://business.facebook.com';
const META_API = 'https://graph.facebook.com https://www.facebook.com';
const CLOUDINARY = 'https://res.cloudinary.com https://api.cloudinary.com';

/**
 * `'unsafe-inline'` in script-src is a deliberate, documented compromise, not
 * an oversight. Next.js inlines its hydration bootstrap into every document;
 * removing it requires a per-request nonce, which in turn forces every page —
 * including the static marketing and legal pages a reviewer reads — to render
 * dynamically. The directive still blocks the thing that matters most: script
 * from any origin other than this one and Meta's SDK. Tightening it to a nonce
 * is worth doing, and is tracked as such rather than pretended away here.
 *
 * `'unsafe-inline'` in style-src is not optional at all: Emotion (which MUI is
 * built on) injects component styles as inline <style> elements at runtime.
 */
// Next's dev server compiles and evaluates modules in the browser, which needs
// 'unsafe-eval'. Production never does, so it is omitted there rather than
// shipped for the sake of one environment.
const isDev = process.env.NODE_ENV !== 'production';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} ${META_SDK}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src \'self\' https://fonts.gstatic.com data:',
  `img-src 'self' data: blob: ${CLOUDINARY} https://*.fbcdn.net https://scontent.whatsapp.net`,
  `connect-src 'self' ws: wss: ${META_API} ${CLOUDINARY}`,
  `frame-src 'self' ${META_FRAMES}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Belt and braces with X-Frame-Options below: frame-ancestors is the
  // directive modern browsers actually honour, the header is for the rest.
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  // Two years, preload-eligible. Safe because the product is HTTPS-only in
  // every environment it is served from.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing in a messaging dashboard needs any of these.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
];

module.exports = { securityHeaders, CONTENT_SECURITY_POLICY };
