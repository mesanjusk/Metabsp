# Troubleshooting

Failure modes specific to this codebase, with exactly where to look.

## "Connect with Meta" fails or hangs

- **Popup never returns / no `wabaId`/`phoneNumberId`**: check
  `META_EMBEDDED_SIGNUP_CONFIG_ID` is set and matches a real Meta Business
  Manager configuration. `listenForEmbeddedSignupData` in
  `frontend/src/utils/facebookSdk.js` only accepts postMessage events from
  an origin ending in `facebook.com` — if the popup is blocked or the SDK
  fails to load, this listener never fires. Check browser console for FB
  SDK load errors first.
- **"code is required" / "wabaId must be a valid Meta WABA ID" (400)**:
  the frontend sent a malformed payload — check the actual POST body to
  `/connect/complete` matches `{code, wabaId, phoneNumberId, businessId}`
  with numeric IDs.
- **429 Too Many Requests**: `connectLimiter` caps connect-flow endpoints
  at 10 requests / 5 min per user (`WhatsAppCloud.js`) — legitimate during
  rapid retry-testing, worth raising temporarily in a dev environment if
  actively debugging the flow.

## Manual connect rejects a valid-looking token

`validateManualWhatsAppCredentials`
(`whatsappCredentialValidationService.js`) calls `/me` and
`/{phoneNumberId}` with the pasted token — a 400 here means the token
itself is invalid/expired, lacks `whatsapp_business_management` scope, or
the `phoneNumberId` doesn't belong to the token's accessible assets. Check
the underlying Graph API error message returned in the response body,
which this service surfaces rather than swallowing.

## Webhook not receiving messages

1. Confirm the webhook is actually subscribed **per WABA**, not just at
   the App level — `subscribeAppToWaba` should have run automatically at
   connect time; check `WhatsAppAccount.webhookSubscribed` on the account
   in question.
2. Confirm `WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE` and `META_APP_SECRET`
   match what Meta is actually signing with — a signature mismatch
   returns 403 and Meta will show delivery failures in its own webhook
   diagnostics panel (App Dashboard → Webhooks).
3. Check `GET /health` — if Mongo is down, message processing (deferred
   via `setImmediate` after the fast ack) will fail silently in the
   background; check server logs for `[whatsapp] contact upsert failed`
   or similar.

## Messages fail to send with "outside 24h window"

This is Meta's own customer-service-window policy, correctly enforced by
`enforceWhatsApp24hWindow` (`backend/src/middleware/whatsapp24hGuard.js`)
— free-form text/media can only be sent within 24h of the customer's last
message; **template** messages work outside that window. This is not a
bug — direct the user to send a template instead.

## Token refresh keeps failing / account shows `status: 'error'`

`tokenRefreshService.js` marks an account `error` when `fb_exchange_token`
fails — the underlying token is genuinely no longer valid (revoked,
expired past repair, or the connecting user lost access). The fix is
reconnecting the number (Embedded Signup or manual connect again), not
retrying the refresh — a truly dead token can't be revived by this app.
Consider migrating that account to a System User token
(`SYSTEM_USER_CREATION.md`) so this doesn't recur.

## A team member can't see an account's conversations

Check `WhatsAppAccount.teamMemberIds` includes their user ID
(`teamService.js`) and that they don't already own a different active
account of their own — `loadActiveWhatsAppAccountForUser` prefers a
user's own owned account over shared-team access; a user who owns
nothing falls back to the most-recently-updated account they're a team
member of. Multiple simultaneous shared-account access for one team
member isn't supported yet (documented limitation, see the original
audit).

## Flaky-looking test failures locally

`whatsappSendQueue.test.js` runs against a real local Redis and can be
sensitive to machine load when running the full suite — see the comment
at the top of that file. A single failure there in isolation (not the
full suite) is a real bug worth investigating; a failure only under the
full ~29-suite run is very likely the documented timing sensitivity, not
a regression.
