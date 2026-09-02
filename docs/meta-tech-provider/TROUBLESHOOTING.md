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

**Start here: Administration → Meta configuration → "Inbound message
delivery".** It runs `GET /api/whatsapp/webhook-diagnostics` (admin only)
and names the first broken stage. Everything below is what each verdict
means and what to do about it — read it after the panel has told you which
one you have.

The reason a checklist is not enough: an inbound message crosses five
stages, each of which fails silently, and **a saved, verified webhook
subscription proves only that stage 1 works**. The verification handshake
is a GET that checks the verify token alone; it never touches the app
secret, never involves a WABA, and never exercises the queue. A callback
URL can verify perfectly and still be refusing, dropping, or hiding every
message that follows.

### 1. Meta decides to deliver

- The app subscription must include the **`messages`** field. Every other
  field can be ticked and no customer message will arrive. App Dashboard →
  WhatsApp → Configuration → Webhook fields.
- The WABA must have this app in its `subscribed_apps`. `subscribeAppToWaba`
  does this at connect time, but a number connected on another environment,
  or before the app id changed, will not be. `GET /api/whatsapp/preflight?wabas=true`
  reports it per account.

### 2. The request reaches this deployment

Meta stores **one callback URL per app**. If it was updated on a different
Meta app, or points at a previous host, deliveries are arriving somewhere
else and nothing local will explain it. The diagnostics compare the URL
Meta actually holds against this deployment's own origin and say so
outright.

### 3. This deployment accepts it

A signature mismatch answers `403`. This is the most common cause of
"verified but nothing arrives", because the two secrets are checked at
different times: `WHATSAPP_WEBHOOK_VERIFY_TOKEN` at verification,
`META_APP_SECRET` on every delivery. A wrong app secret therefore looks
perfect in the dashboard.

- Every rejection is now logged — grep for `Webhook rejected` in the
  server logs.
- The delivery counters distinguish "Meta has never POSTed here" from "Meta
  POSTs and we refuse it". Those are opposite problems: the first is a
  Meta-side subscription, the second is `META_APP_SECRET`.
- The app secret must belong to the **same Meta app** the callback URL is
  registered under. Setting `WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE=false` is a
  way to confirm the diagnosis for a minute, never a fix to leave in place.

### 4. Something processes it

An accepted payload is queued and answered `200` immediately. If no replica
runs the queue worker (`RUN_BACKGROUND_JOBS=false` everywhere), the
endpoint stays perfectly healthy while jobs accumulate and no message is
ever written. The diagnostics report the attached worker count and the
queue depth.

If Redis is unreachable the handler falls back to processing inline —
slower, but the message is kept. That fallback is bounded by
`WEBHOOK_ENQUEUE_TIMEOUT_MS` (default 2500ms) because the shared Redis
connection buffers commands indefinitely rather than failing, so without a
bound the request hangs instead of falling back.

### 5. It lands somewhere visible

The quietest failure of all: an inbound message whose `phone_number_id` /
WABA matches no connected account is **saved with no owner**, and every
inbox query is scoped by `userId` or `whatsappAccountId`. Delivered,
acknowledged, stored — and invisible to everyone.

The log line is `matched NO connected WhatsApp account`, and the
diagnostics count these rows over the last 24 hours. The cause is always
that the number sending traffic is not one this deployment has connected:
connected on another environment, a `phoneNumberId` that changed, or an
account row left `disconnected`.

Per-number receipt times are on the same panel — `lastWebhookAt` is written
on every matched inbound event, so it answers "which of my numbers is
actually receiving?" directly.

## Messages fail to send with "outside 24h window"

This is Meta's own customer-service-window policy, correctly enforced by
`enforceWhatsApp24hWindow` (`nextjs/lib/whatsapp/twentyFourHourGuard.ts`)
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
