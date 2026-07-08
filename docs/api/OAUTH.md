# OAuth (Meta) — developer reference

This platform's only OAuth flow is with **Meta**, not with third-party
developers of this platform's own API (see `AUTHENTICATION.md` — there is
no third-party-facing OAuth authorization flow here). This doc is the
short developer-reference version of
`docs/meta-tech-provider/OAUTH.md` for anyone extending the connect flow.

## Endpoints involved

| Step | Call | Handler |
|---|---|---|
| 1. Exchange authorization code | `GET https://graph.facebook.com/{version}/oauth/access_token` (`grant_type` omitted, `code` param) | `completeEmbeddedSignup` |
| 2. Extend to long-lived token | Same URL, `grant_type=fb_exchange_token` | `completeEmbeddedSignup`, `refreshExpiringTokens` |
| 3. Periodic refresh | Same as step 2, run daily for tokens expiring within 7 days | `tokenRefreshService.js` |

`RESOLVED_API_VERSION` (from `backend/src/config/graphApi.js`) controls
`{version}` — set via `WHATSAPP_API_VERSION`.

## Building your own integration against this pattern

If you're building a similar Embedded-Signup-consuming flow elsewhere,
the two things worth copying directly from this codebase:

1. **Never let the client secret reach the browser.** The frontend only
   ever handles the `code`; every exchange call in the table above
   happens server-side with `META_APP_SECRET` read from environment,
   never serialized into a response.
2. **Validate IDs before trusting them.** `isMetaNumericId()` in
   `whatsappController.js` rejects non-numeric `wabaId`/`phoneNumberId`/
   `businessId` before they reach a Graph API call or a database write —
   a `postMessage`-delivered payload is client-supplied data and should be
   validated like any other.

## Token introspection

Meta exposes `GET /debug_token?input_token=...&access_token=...` to check
a token's scopes/expiry/validity directly — useful when troubleshooting a
connect failure, not currently called anywhere in this codebase but a
reasonable addition if you need programmatic token-health checks beyond
what `checkWhatsAppHealth` (`whatsappHealthService.js`) already does by
attempting a real API call.
