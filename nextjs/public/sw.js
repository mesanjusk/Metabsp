/* eslint-disable no-restricted-globals */

/**
 * The service worker.
 *
 * What it is for, in order of how much it matters to a customer:
 *
 *   1. Installability. Android will not offer "Add to home screen", and Chrome will not fire
 *      `beforeinstallprompt`, without a controlling service worker and a manifest. The APK (a
 *      Trusted Web Activity wrapping this origin) and the Windows package are both built on the
 *      same requirement, so this file is what makes all three possible rather than only the web app.
 *   2. A first paint on a bad connection. The shell and the icons are cached on install, so opening
 *      the app on a train shows the app rather than the browser's dinosaur.
 *   3. An honest offline page instead of a browser error, so a shop with patchy 4G sees the product
 *      say what happened.
 *
 * What it deliberately does NOT do is cache anything under /api. Every response there is
 * per-tenant, most of it is a live conversation, and a stale message list or a stale balance is
 * worse than no answer at all — it looks like data loss. Those requests always go to the network
 * and are allowed to fail.
 */

const VERSION = 'v1';
const SHELL_CACHE = `sanjusk-shell-${VERSION}`;
const RUNTIME_CACHE = `sanjusk-runtime-${VERSION}`;

/**
 * Cached on install.
 *
 * Deliberately short. The HTML documents are NOT in here: every page renders per request with a
 * fresh CSP nonce (see middleware.ts), so a cached document carries a nonce that matches nothing
 * and the browser blocks its own hydration script — the page would arrive looking fine and be
 * completely dead. Documents are network-first below for the same reason.
 */
const SHELL_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // One missing asset must not fail the whole install — an uninstalled worker means no
      // installability at all, which is a much bigger loss than one uncached icon.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** The page asks for this after a deploy so the new worker takes over without a second reload. */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

function isApi(url) {
  return url.pathname.startsWith('/api/') || url.pathname === '/webhook';
}

/** Content-hashed by the build, so the file at this URL can never change meaning. */
function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

function isIcon(url) {
  return url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is cacheable, and only this origin is ours to cache. A cross-origin request (Meta's
  // SDK, Cloudinary) goes straight through untouched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApi(url)) return;

  // Socket.IO's polling transport is a GET to this origin that must never be served from a cache.
  if (url.pathname.startsWith('/socket.io/')) return;

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (isIcon(url)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDocument(request));
  }
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

/**
 * Documents: always the network, and the offline page only when the network is genuinely gone.
 *
 * A 404 or a 500 is a real answer and is shown as-is — swapping a server error for "you are
 * offline" would send someone to check their wifi over a bug on our side.
 */
async function networkFirstDocument(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match('/offline.html')) ?? Response.error();
  }
}
