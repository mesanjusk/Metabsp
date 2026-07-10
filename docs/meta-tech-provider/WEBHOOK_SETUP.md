# Webhook setup

## Registering the webhook URL with Meta

In your Meta App's WhatsApp product configuration:

- **Callback URL**: `https://<your-domain>/webhook` (also reachable at
  `/api/whatsapp/webhook` — both are mounted to the same handler in
  `backend/src/app.js`).
- **Verify token**: any string you choose — set it as
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in the backend's environment
  (`backend/.env.example`) and enter the exact same value in the Meta App
  dashboard.
- **Subscribe to**: at minimum the `messages` field. This app also parses
  message `statuses` (delivered/read/failed) from the same field.

## The verification handshake (`GET /webhook`)

Meta sends `GET /webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
once when you save the callback URL. `verifyWebhook` in
`backend/src/controllers/whatsappController.js` checks the verify token
against `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (via
`backend/src/config/graphApi.js`'s `getWebhookVerifyToken()`, which also
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
promptly. `receiveWebhook` responds `{received: true}` immediately after
signature/object-type checks, then processes messages/status updates
(contact upserts, auto-reply/workflow matching, CRM webhook fan-out, media
download) via `setImmediate` in the background — a slow downstream
integration never blocks the ack Meta is waiting for.

## Idempotency

Duplicate deliveries (Meta's own retries) are de-duplicated before
triggering side effects like auto-replies — look for the `isDuplicate`
check in `receiveWebhook` if extending this logic.
