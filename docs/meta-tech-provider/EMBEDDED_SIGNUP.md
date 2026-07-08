# Embedded Signup — how it actually works in this codebase

Embedded Signup is Meta's flow for letting a customer connect their own
WhatsApp Business Account without your team ever handling their
credentials. This is fully implemented — here is the exact, real flow.

## The three pieces

1. **Frontend SDK load** — `frontend/src/utils/facebookSdk.js`'s
   `loadFacebookSdk({appId, apiVersion})` injects Facebook's JS SDK script
   tag and resolves once `fbAsyncInit` fires.
2. **The signup popup + postMessage listener** — Meta's popup returns an
   OAuth `code` via `FB.login()`'s own callback, but separately posts
   `wabaId`/`phoneNumberId`/`businessId` via `window.postMessage` events
   typed `WA_EMBEDDED_SIGNUP`. `listenForEmbeddedSignupData({timeoutMs})`
   in the same file listens for these, verifying `event.origin.endsWith('facebook.com')`
   before trusting the payload. `frontend/src/Pages/WhatsAppCloudDashboard.jsx`'s
   `handleConnectFlow` races both of these (the code callback and the
   postMessage listener) and combines them.
3. **Server-side exchange** — the frontend POSTs `{code, wabaId, phoneNumberId, businessId}`
   to `POST /api/whatsapp/connect/complete`, handled by
   `completeEmbeddedSignup` in `backend/src/controllers/whatsappController.js`:
   - Exchanges `code` for a short-lived token via Graph API
     `/oauth/access_token`.
   - Exchanges that for a long-lived token (~60 days) via
     `grant_type=fb_exchange_token` — falls back to the short-lived token
     if this step fails rather than aborting the whole connect.
   - Validates `wabaId`/`phoneNumberId`/`businessId` are numeric Meta IDs
     before using them (rejects anything else with a 400).
   - Fetches phone number details (`display_phone_number`, `verified_name`).
   - Calls `subscribeAppToWaba` — `POST /{waba-id}/subscribed_apps` — so
     this app actually receives webhooks for the newly connected number.
   - Encrypts the token (AES-256-GCM, `src/utils/crypto.js`) and upserts
     a `WhatsAppAccount` document, activating it for the user.

## What you need configured

- `META_APP_ID`, `META_APP_SECRET` — from your verified Business
  Manager's app.
- `META_EMBEDDED_SIGNUP_CONFIG_ID` — the Embedded Signup configuration
  created in Meta Business Manager (Facebook Login for Business setup,
  see `BUSINESS_VERIFICATION.md`). Without this, the flow falls back to
  the "Connect manually" dialog — check
  `frontend/src/Components/whatsappCloud/WhatsAppAttendanceSettings.jsx`'s
  `onManualConnect` handler for that fallback path.

## Rate limiting

`POST /connect/complete`, `POST /connect/manual`, and
`POST /embedded-signup/exchange-code` are all rate-limited to 10 requests
per 5 minutes per user (`connectLimiter` in `backend/src/routes/WhatsAppCloud.js`)
— these call out to Meta's Graph API on every request, so this both curbs
abuse and avoids burning through Meta's own per-app API limits.

## Verifying this against Meta's live App Review process

Everything above is real, working code — verified via this session's own
tests and manual code review. It has **not** been exercised against a
live, App-Review-approved Meta Business app with real Embedded Signup
traffic. Before submitting for App Review, run through the actual flow
end-to-end against a Meta test app in Development Mode (Meta allows this
without full App Review) and confirm the popup, postMessage events, and
server exchange all behave as this doc describes with real Meta responses.

## Known gap: Facebook Login for Business specifics

Meta's Embedded Signup formally requires a **Facebook Login for Business**
configuration (distinct from consumer Facebook Login) tied to
`META_EMBEDDED_SIGNUP_CONFIG_ID`. The code here uses the standard FB JS
SDK login call with that config ID passed through — this is the documented
integration pattern, but whether every nuance of Facebook Login for
Business (e.g. required scopes, asset-based permissions) is fully
satisfied can only be confirmed by testing against a real, configured
Meta Business Manager — flag this as unverified-in-this-sandbox rather
than claiming certainty.
