# OAuth mechanics

The token-exchange plumbing behind both Embedded Signup and manual
connect. All of this lives in
`backend/src/controllers/whatsappController.js`.

## Token exchange sequence

1. **Authorization code → short-lived token**: `GET /oauth/access_token`
   with `client_id`, `client_secret`, `code`. The client secret never
   leaves the server — the frontend only ever handles the `code`.
2. **Short-lived → long-lived token**: `GET /oauth/access_token` again
   with `grant_type=fb_exchange_token`, exchanging the short-lived token
   for one valid ~60 days. Non-fatal if this fails; falls back to the
   short-lived token rather than aborting the connect.
3. **Long-lived token refresh**: `backend/src/services/tokenRefreshService.js`
   runs daily (`startTokenRefreshScheduler`, started from `src/index.js`),
   finds accounts with `tokenExpiresAt` within 7 days, and re-runs step 2
   against the still-valid token. A token that's already expired/invalid
   fails the exchange and the account is marked `status: 'error'` so the
   customer is prompted to reconnect, rather than silently failing sends.
   Accounts with `tokenSource: 'system_user'` are excluded — see
   `SYSTEM_USER_CREATION.md`.

## Why there's no traditional "state" CSRF parameter

Classic redirect-based OAuth uses a `state` parameter to prevent an
attacker forging a callback request to a public URL. Embedded Signup
doesn't work that way: the authorization `code` arrives via an in-page JS
callback (`FB.login()`'s own promise/callback, plus `postMessage` events —
see `EMBEDDED_SIGNUP.md`) inside the already-authenticated user's own
browser tab, not via a redirect to a public callback route an attacker
could target. There is no cross-site request to protect against in the
way classic OAuth needs — this was a deliberate design confirmation, not
an oversight (see the commit history around `completeEmbeddedSignup`'s
input validation hardening for the actual reasoning at the time).

## Manual connect (no Embedded Signup)

`POST /connect/manual` (`manualConnect` handler) accepts a pasted
`accessToken` + `phoneNumberId` + `businessAccountId`/`wabaId` directly —
for customers who already have a token from Meta Business Manager, or
platforms not using the Embedded Signup UI. Validates the token actually
works against the Graph API
(`backend/src/services/whatsappCredentialValidationService.js`) before
storing it, and calls the same `subscribeAppToWaba` webhook-subscription
step Embedded Signup does.

## Access token storage

Every token — however it arrived — is AES-256-GCM encrypted before
touching the database. See `ACCESS_TOKENS.md`.
