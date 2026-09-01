import { NextRequest, NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildCsp } = require('./lib/http/securityHeaders');

/**
 * Cross-origin policy.
 *
 * The Express app had a CORS allow-list; the Next.js port shipped without one,
 * which meant every browser-originated cross-site request to the dashboard API
 * was simply refused by the browser's default (no ACAO header) — fine while
 * the SPA was same-origin, and silently broken for anything else. This makes
 * the policy explicit, and different for the two API surfaces, because they
 * have genuinely different threat models:
 *
 *   /api/v1/*   — machine-to-machine, authenticated by an API key in a header.
 *                 A browser cannot attach that key automatically, so there is
 *                 no cross-site request forgery to prevent, and any origin may
 *                 call it. Credentials are explicitly NOT allowed, which is
 *                 what keeps that true.
 *
 *   everything  — the dashboard's own API, authenticated by a bearer token.
 *   else          Only the configured application origins may call it, so a
 *                 hostile page cannot drive the API on a signed-in user's
 *                 behalf even if it obtains a token.
 *
 * ALLOWED_ORIGINS is a comma-separated list; FRONTEND_URL is honoured as a
 * single-origin shorthand for the common case.
 */
function allowedOrigins(): string[] {
  return String(process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((entry) => entry.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

const PUBLIC_API_PREFIX = '/api/v1';
// Meta calls this from its own infrastructure with no Origin header at all;
// it must never be subject to an origin decision.
const WEBHOOK_PATHS = ['/webhook', '/api/whatsapp/webhook'];

function applyCors(req: NextRequest, res: NextResponse): NextResponse {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin');

  if (WEBHOOK_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return res;
  }

  if (pathname.startsWith(PUBLIC_API_PREFIX)) {
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
    res.headers.set('Access-Control-Max-Age', '86400');
    return res;
  }

  // Same-origin requests send no Origin header; nothing to decide.
  if (!origin) return res;

  const normalized = origin.replace(/\/$/, '');
  const list = allowedOrigins();
  // An unset allow-list must not lock the deployment out of its own API, so
  // the fallback is same-origin only — which is what an unlisted origin gets
  // by simply receiving no ACAO header.
  if (list.includes(normalized)) {
    res.headers.set('Access-Control-Allow-Origin', normalized);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Vary', 'Origin');
  }

  return res;
}

/**
 * Per-request Content-Security-Policy nonce.
 *
 * Next reads the nonce out of the `Content-Security-Policy` header on the
 * REQUEST and stamps it onto the script tags it renders — which is what lets
 * the policy drop `'unsafe-inline'` for scripts. Setting it only on the
 * response would leave Next's own bootstrap unnonced and therefore blocked.
 *
 * crypto.randomUUID is available in the edge runtime middleware runs in; a
 * per-request value is the whole point, so this must never be hoisted out.
 */
function withCsp(req: NextRequest, response: NextResponse, nonce: string, csp: string): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);
  return response;
}

export function middleware(req: NextRequest) {
  // A preflight must be answered here: it never reaches a route handler, and
  // an unanswered OPTIONS is indistinguishable from a blocked API.
  if (req.method === 'OPTIONS') {
    return applyCors(req, new NextResponse(null, { status: 204 }));
  }

  const nonce = crypto.randomUUID();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return withCsp(req, applyCors(req, response), nonce, csp);
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own build output and the favicon. Pages are
     * included deliberately — the nonce has to reach the HTML document, not
     * just the API — while _next/static assets carry no inline script and
     * would only add work per request.
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)',
  ],
};
