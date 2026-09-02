# Webhook setup

## Registering the webhook URL with Meta

In your Meta App's WhatsApp product configuration:

- **Callback URL**: `https://<your-domain>/webhook` (also reachable at
  `/api/whatsapp/webhook` — both are mounted to the same handler in
  `backend/src/app.js`).
- **Verify token**: any string you choose — set it as
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in the backend's environment
  (`nextjs/.env.example`) and enter the exact same value in the Meta App
  dashboard.
- **Subscribe to**: at minimum the `messages` field. This app also parses
  message `statuses` (delivered/read/failed) from the same field.
  If you offer Coexistence, also subscribe to `history`,
  `smb_message_echoes` and `smb_app_state_sync` — without them a
  coexistence number onboards successfully and then never delivers chat
  history, WhatsApp-Business-app messages, or contacts. See
  `COEXISTENCE.md`.

## The verification handshake (`GET /webhook`)

Meta sends `GET /webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
once when you save the callback URL. `verifyWebhook` in
`backend/src/controllers/whatsappController.js` checks the verify token
against `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (via
`nextjs/lib/config/graphApi.ts`'s `getWebhookVerifyToken()`, which also
accepts the legacy `WHATSAPP_VERIFY_TOKEN`/`VERIFY_TOKEN` names) and
echoes back `hub.challenge` on success.

## Per-WABA subscription (not just the App-level callback)

Registering the callback URL at the App level isn't enough on its own —
each WABA also needs the app subscribed to it specifically. This app
handles that automatically: `subscribeAppToWaba({wabaId, accessToken})`
calls `POST /{waba-id}/subscribed_apps` at the end of both the Embedded
Signup and manual connect flows, so a newly connected number starts
receiving webhooks with no manual step.

## Signature verification (`POST /webhook`)

Every inbound webhook delivery is HMAC-SHA256 verified before anything
else runs:

```
X-Hub-Signature-256: sha256=<hex-hmac-of-raw-body-using-META_APP_SECRET>
```

`receiveWebhook` computes the expected signature over `req.rawBody` (the
raw bytes, captured by an `express.json({verify: ...})` hook in
`src/app.js` — signature verification would silently break if this raw
capture were ever removed) and compares using `crypto.timingSafeEqual`.
Enforcement is on by default; `WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE=false`
disables it (development only — never in production).

## Multi-product webhook URLs

If the same Meta App is also subscribed to other products (Page,
Instagram) sharing this URL, `receiveWebhook` checks the payload's
top-level `object` field and acknowledges-but-ignores anything that isn't
`whatsapp_business_account`, rather than attempting to parse a
differently-shaped payload as WhatsApp data.

## Fast-ack pattern

Meta expects a fast `200` and will retry deliveries that don't get one
promptly — and eventually disables a subscription that keeps timing out.
`handleReceiveWebhook` therefore does exactly two things before answering:
verifies the HMAC signature, and puts the envelope on a durable BullMQ
queue (`whatsapp-webhook-inbound`). The real work — media download and
Cloudinary re-upload, destination fan-out, auto-reply and workflow
matching — runs in `processWebhookEnvelope` on the queue worker, where it
survives a restart because it was persisted before the ack was sent.

If the enqueue fails **or does not answer within
`WEBHOOK_ENQUEUE_TIMEOUT_MS` (default 2500ms)**, the payload is processed
inline instead of being dropped: a slow ack is recoverable, a lost customer
message is not. The timeout is not tuning. The shared Redis connection sets
`maxRetriesPerRequest: null` with ioredis's offline queue on, so a command
issued while Redis is unreachable is buffered and retried forever rather
than rejecting — the fallback was written for a Redis outage and was the
one thing a Redis outage could not trigger.

A queue with no consumer is the other half of this: if every replica runs
with `RUN_BACKGROUND_JOBS=false`, deliveries are accepted, acknowledged
`200`, and never processed. See the diagnostics below.

## Coexistence fields

`history`, `smb_message_echoes` and `smb_app_state_sync` arrive on this
same endpoint, distinguished by `entry[].changes[].field`, and are handled
by `nextjs/lib/services/coexistenceService.ts`. They are parsed up front,
before the fast ack above, and processed history-first, so backfilled
messages land before live traffic. Full detail — including why
echoes never trigger Auto Reply and never reopen the 24-hour window — is
in `COEXISTENCE.md`.

## Idempotency

Duplicate deliveries (Meta's own retries) are de-duplicated before
triggering side effects like auto-replies — look for the `isDuplicate`
check in `receiveWebhook` if extending this logic.

## Diagnosing "configured, but nothing arrives"

A verified subscription proves the GET handshake passed, which needs only
the verify token. It says nothing about the app secret, the WABA
subscription, the queue worker, or whether a stored message has an owner —
each of which fails silently and independently.

`GET /api/whatsapp/webhook-diagnostics` (admin) walks all five stages in
delivery order and names the first broken one; the same report is rendered
at Administration → Meta configuration → "Inbound message delivery".
Stage-by-stage explanations of each verdict are in `TROUBLESHOOTING.md`
under "Webhook not receiving messages".

Two of its inputs are worth knowing about on their own:

- **Delivery counters** (`lib/whatsapp/webhookTelemetry.ts`) record what
  reached the endpoint and what was done with it. They are what separates
  "Meta has never called us" from "Meta calls us and we return 403" — the
  same symptom with opposite fixes. Best-effort and Redis-backed; an
  unreachable Redis makes them unavailable, not wrong.
- **Rejection logs.** Every 403 is logged with its reason. Previously a
  refused delivery was silent on both sides: Meta keeps the response body
  to itself, and nothing here said a word.
