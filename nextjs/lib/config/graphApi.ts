// Ported from backend/src/config/graphApi.js — single source of truth for the
// Meta Graph API version + webhook verify-token lookup. Must stay in lockstep
// with the always-on host's copy (same env var names).
//
// Two version concerns are deliberately kept separate (see
// docs/meta-tech-provider/COEXISTENCE.md § Version management):
//
//   1. GRAPH API VERSION (WHATSAPP_API_VERSION) — every server-side Graph call:
//      the OAuth code exchange, debug_token, phone-number discovery, the WABA
//      subscription, sending messages, media downloads. Bumping it is a change
//      that touches all of those, so re-test send/receive after changing it.
//
//   2. JS SDK VERSION (META_JS_SDK_VERSION) — only the `version` passed to
//      FB.init() in the browser for the Embedded Signup popup. Meta's Embedded
//      Signup Builder generates an FB.init version that can move ahead of the
//      Graph version we make server calls with, and there is no reason to hold
//      the browser SDK back to the Graph version (or vice versa). Served to the
//      browser via GET /api/whatsapp/connect/config.
//
// Both default to the same validated baseline so a deployment that sets only
// one still behaves; set META_JS_SDK_VERSION explicitly to match the current
// Meta Builder output.
const DEFAULT_GRAPH_API_VERSION = 'v23.0';

export function getGraphApiVersion(): string {
  return process.env.WHATSAPP_API_VERSION || process.env.META_API_VERSION || DEFAULT_GRAPH_API_VERSION;
}

// The Facebook JS SDK version the browser initialises for Embedded Signup.
// Falls back to the Graph API version when unset, so a single-version
// deployment keeps working unchanged.
export function getJsSdkVersion(): string {
  return process.env.META_JS_SDK_VERSION || getGraphApiVersion();
}

export function getWebhookVerifyToken(): string {
  return (
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    process.env.VERIFY_TOKEN ||
    ''
  );
}
