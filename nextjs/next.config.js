/** @type {import('next').NextConfig} */
const path = require('path');
const { securityHeaders } = require('./lib/http/securityHeaders');

const nextConfig = {
  // Pins the standalone file trace to this app. Without it the build traces
  // the whole repository as its workspace root.
  outputFileTracingRoot: path.join(__dirname),

  // Node-native packages that should be required at runtime rather than
  // bundled by webpack — bundling bullmq in particular pulls in an optional
  // dynamic import (@valkey/valkey-glide, an alternative Redis client we do
  // not use) that webpack otherwise warns about at build time.
  serverExternalPackages: ['bullmq', 'mongoose', 'ioredis', '@socket.io/redis-emitter', 'pdfkit'],

  // Leaks the framework and version to anyone probing the service; there is
  // no reason to advertise it.
  poweredByHeader: false,

  // Meta's reviewers and customers both hit this over the public internet;
  // a trailing-slash redirect on a webhook URL is a needless failure mode.
  trailingSlash: false,

  async headers() {
    return [
      {
        // Security headers belong on every response, not just documents:
        // an API response rendered directly in a browser tab is still a
        // sniffing and framing target.
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // The HTML shell must never be cached aggressively, or a stale deploy
        // can mask a fixed one behind a CDN. Next's own /_next/static/* assets
        // are content-hashed and safe to cache long-lived without extra config.
        source: '/',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        // Nothing under /api is cacheable: every response is either
        // per-tenant data or an action's result.
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },

  async redirects() {
    return [
      // Short, guessable paths that were linked from the marketing pages,
      // the consent dialog and the WhatsApp opt-in banner but had no route
      // behind them — every one of these was a 404 for a visitor, including
      // the Privacy Policy and Terms links Meta's own review checks.
      { source: '/privacy', destination: '/privacy-policy', permanent: true },
      { source: '/terms', destination: '/terms-of-service', permanent: true },
      { source: '/cookies', destination: '/cookie-policy', permanent: true },
      { source: '/help', destination: '/help-center', permanent: true },
      { source: '/docs', destination: '/developer-docs', permanent: true },
      { source: '/support', destination: '/contact', permanent: true },
      // The dashboard's own auth routes were served from '/cloud-*' paths, a
      // leftover of running two products side by side. They are the canonical
      // '/signup' and '/forgot-password' now; the old paths keep working so
      // any bookmark or Meta dashboard entry pointing at them still resolves.
      { source: '/cloud-signup', destination: '/signup', permanent: true },
      { source: '/cloud-forgot-password', destination: '/forgot-password', permanent: true },
      // The dashboard was one page at '/whatsapp' with every section behind a
      // tab. Those sections are routes now; this keeps existing bookmarks,
      // support articles and App Review testing instructions resolving.
      // A config redirect rather than a redirect() in a page component: the
      // page variant prerenders to a 200 with a client-side hop, which is not
      // a redirect any crawler, curl or Meta reviewer would recognise.
      { source: '/whatsapp', destination: '/inbox', permanent: true },
      { source: '/whatsapp/:path*', destination: '/inbox', permanent: true },
    ];
  },
};

module.exports = nextConfig;
