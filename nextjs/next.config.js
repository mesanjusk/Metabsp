/** @type {import('next').NextConfig} */
const path = require('path');

/*
 * outputFileTracingRoot: the repo has lockfiles at both the root and in
 * nextjs/, so Next infers the repo root as the workspace and warns. Pinning it
 * here keeps the standalone file trace scoped to this app — without it the
 * Render build traces the whole monorepo, including the Express backend this
 * is meant to replace.
 */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // Node-native packages that should be required at runtime rather than
  // bundled by webpack — bundling bullmq in particular pulls in an optional
  // dynamic import (@valkey/valkey-glide, an alternative Redis client we
  // don't use) that webpack otherwise warns about at build time.
  serverExternalPackages: ['bullmq', 'mongoose', 'ioredis'],
  // Same rationale as the pre-existing vercel.json fix for the Vite SPA
  // (see git history: "Prevent stale cached index.html/service-worker from
  // masking new deploys") — the HTML/document shell must never be
  // aggressively cached, or a stale deploy can mask a fixed one behind a CDN
  // cache. Next.js's own /_next/static/* assets are already content-hashed
  // and safe to cache long-lived without any extra config here.
  async headers() {
    return [
      {
        source: '/',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
