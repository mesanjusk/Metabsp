# Coexistence — WhatsApp Business app + Cloud API on one number

Coexistence lets a customer keep using the **WhatsApp Business app** on
their phone while this platform also sends and receives on the *same*
number through Cloud API. It is the difference between "give us your
number and stop using your phone" and "keep working exactly as you do
today, and we'll sync". For SMB customers that is usually the deciding
factor in whether they onboard at all.

This document describes what this repository actually implements. Where
Meta's own process or console configuration is required and this repo
can't do it for you, that is stated plainly.

## How it differs from ordinary Embedded Signup

| | Cloud API only | Coexistence |
|---|---|---|
| WhatsApp Business app after onboarding | Stops working on that number | Keeps working |
| Onboarding step | Number verification (SMS/voice PIN) | Customer scans a QR code in the app's *Linked devices* screen |
| `extras.featureType` in `FB.login` | *(omitted)* | `whatsapp_business_app_onboarding` |
| Existing chat history | None | Up to 6 months backfilled via the `history` webhook |
| Messages the business sends from their phone | Invisible to the platform | Arrive as `smb_message_echoes` webhooks |
| Contacts | Manual/CRM only | Synced via `smb_app_state_sync` |
| `connectionMode` stored here | `embedded_signup` | `coexistence` |

## The onboarding flow in this codebase

1. **`GET /api/whatsapp/connect/config`** (`getConnectConfig` in
   `backend/src/controllers/whatsappController.js`) returns
   `coexistenceEnabled`, `featureType` and `sessionInfoVersion` alongside
   the existing `appId`/`configId`/`apiVersion`. Coexistence is on unless
   `META_ENABLE_COEXISTENCE=false`.
2. **`FB.login` extras** — `handleConnectFlow` in
   `frontend/src/Pages/WhatsAppCloudDashboard.jsx` passes:
   ```js
   extras: {
     setup: {},
     sessionInfoVersion: '3',
     featureType: 'whatsapp_business_app_onboarding',
   }
   ```
   `featureType` is *additive*: the same popup still runs the ordinary
   Cloud API path for a customer who has no WhatsApp Business app. When
   the deployment disables coexistence the key is omitted entirely and
   the popup behaves exactly as it did before.
3. **Finish event** — `listenForEmbeddedSignupData` in
   `frontend/src/utils/facebookSdk.js` now resolves on
   `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` in addition to `FINISH` and
   `FINISH_ONLY_WABA`, and returns a `coexistence` boolean (also inferred
   from a `FINISH` whose `data.current_step` names the WhatsApp Business
   app screen).
4. **Server-side exchange** — `completeEmbeddedSignup` takes the same
   `code`/`wabaId`/`phoneNumberId` path as before, then additionally
   reads Meta's `platform_type` for the number. The account is stored as
   `connectionMode: 'coexistence'` when *either* the browser reported a
   coexistence finish *or* `platform_type` is `SMB_APP` — so a tampered
   client flag alone cannot mislabel an ordinary Cloud API number.
   `platform_type` is fetched in its own request, not appended to the
   existing `display_phone_number,verified_name` call: an unknown `fields`
   entry fails the whole request, and losing the display number would
   matter far more than losing this hint.

The Next.js port does the same thing in
`nextjs/app/api/whatsapp/connect/config/route.ts` and
`nextjs/app/api/whatsapp/embedded-signup/exchange-code/route.ts`.

## The three coexistence webhooks

These arrive on the **same** `/webhook` endpoint as ordinary `messages`
events, distinguished by `entry[].changes[].field`. A Cloud-API-only
integration never sees them, and — this is the part that silently breaks
coexistence deployments — an integration that doesn't handle them will
happily onboard a number and then show an empty, permanently stale inbox.

Handled by `backend/src/services/coexistenceService.js` (and its port,
`nextjs/lib/whatsapp/coexistence.ts`):

### `history`
Meta streams up to 6 months of the customer's existing chats in chunks
after onboarding, each with `metadata.progress` (0-100), `metadata.phase`
and `metadata.chunk_order`, and `threads[].messages[]`.

- Direction is derived by comparing each message's `from` against the
  business's own display number.
- Messages are stored with `isHistorical: true` and
  `source: 'coexistence_history'`.
- They deliberately **do not** trigger Auto Reply, Workflows, keyword
  routing, or media downloads — this is already-delivered history, not
  live traffic. Replying to a three-month-old message would be worse than
  not importing it at all.
- Progress is mirrored onto the account
  (`coexistence.historySyncStatus` / `historySyncProgress` /
  `historyChunksReceived` / `historyMessagesImported`) so the dashboard
  can show "importing chat history (40%)" instead of an empty inbox.

### `smb_message_echoes`
Every message the customer subsequently sends **from the WhatsApp
Business app or a linked device** is echoed to `value.message_echoes[]`.

- Stored as an ordinary outgoing message (`direction: 'outgoing'`,
  `source: 'coexistence_app'`), so the shared team inbox shows what the
  owner already said instead of drifting out of sync.
- Auto Reply and Workflows are **not** run: the message came from the
  business, not from a customer.
- The 24-hour customer service window is **not** reopened — only a
  customer message does that.
- Forwarded to this account's webhook destinations as
  `event: 'message.echo'`, which is what lets a sibling bot detect that a
  human already answered and stand down.
- De-duplicated by `messageId`, so an echo of a message this platform
  itself sent through Cloud API (same `wamid`) is a no-op.

### `smb_app_state_sync`
Contacts added/changed/removed in the WhatsApp Business app arrive in
`value.state_sync[]`.

- Adds/updates upsert a `Contact` (name from `full_name`/`first_name`).
- A `remove` is **recorded** (`customFields.coexistenceRemovedAt`) and
  never deletes the contact: dropping someone from a phone's address book
  must not destroy that conversation's history or its billing/audit trail
  here. If your business decision differs, change it here deliberately.

## Required Meta App configuration (you must do this)

In **App Dashboard → WhatsApp → Configuration → Webhook fields**,
subscribe to all of these:

- `messages` *(already required)*
- `history`
- `smb_message_echoes`
- `smb_app_state_sync`

Webhook **field** subscriptions are app-level in Meta's dashboard — there
is no Graph API call this repo can make to set them per WABA.
`subscribeAppToWaba` (`POST /{waba-id}/subscribed_apps`) subscribes the
app to each customer's WABA, which is necessary but not sufficient: if
the three fields above are not ticked, coexistence numbers onboard
successfully and then never deliver history, echoes, or contacts.

**This is why `META_ENABLE_COEXISTENCE` exists.** The code defaults it to
on, but `render.yaml` ships it explicitly `false` — flip that to `"true"`
(and redeploy, since the Graph version and config are read at boot) once
the fields above are ticked. That way the rest of this work can ship
before the Meta App configuration is touched, without onboarding numbers
whose Business-app traffic silently goes nowhere.

### Graph API version

`WHATSAPP_API_VERSION` (`render.yaml`) feeds both the server's Graph calls
and — via `GET /api/whatsapp/connect/config` — the Facebook JS SDK version
the browser initialises for the Embedded Signup popup. It is pinned to
`v20.0`, which predates coexistence's availability. Confirm against Meta's
current changelog which version first supports
`featureType: 'whatsapp_business_app_onboarding'` and the three webhook
fields, and bump this before enabling coexistence. Treat it as a change
affecting every Graph call in the app, not a coexistence-only edit:
re-test ordinary send/receive after bumping.

## Permissions

Coexistence needs no permission beyond what this app already requests —
`whatsapp_business_management` and `whatsapp_business_messaging` (see
`REQUIRED_PERMISSIONS.md`). What it does need is the webhook field
subscriptions above and an Embedded Signup configuration that permits the
WhatsApp Business app onboarding path.

## Meta-side eligibility limits (not enforceable in code)

These are Meta's rules about which numbers can use coexistence at all.
Nothing in this repository can work around them; they belong in your
support scripts, because they generate the majority of "the QR code
didn't work" tickets:

- The customer must be using the **WhatsApp Business app** (not the
  consumer WhatsApp app), version 2.24.17 or later.
- The number must currently be live on that app, and must **not** already
  be registered on Cloud API.
- Meta expects a history of real use on the app before allowing the link
  (reported as roughly a week).
- Coexistence is available only in Meta's supported countries; the list
  has grown over time, so check it rather than trusting any snapshot.
- Templates must be created and sent through the API — they cannot be
  sent from the WhatsApp Business app.
- Official Business Account (green/blue badge) is not available for
  coexistence numbers.
- Throughput is lower than a dedicated Cloud API number, which matters
  for large broadcasts.
- The customer must open the Business app periodically to keep the link
  alive.

Verify each of these against Meta's current documentation before quoting
them to a customer.

## What has and has not been verified here

Verified in this repository: the webhook parsing and persistence for all
three fields, including direction derivation, de-duplication, the
"echoes must not reopen the 24-hour window" rule and the "removal is not
a delete" rule — see `backend/__tests__/coexistenceWebhook.test.js`.

**Not** verified: live traffic from a real, App-Review-approved Meta
Business app. The payload shapes here follow Meta's documented structure
and are parsed defensively (an unrecognised shape yields no events rather
than throwing inside the webhook handler), but before relying on this
commercially, run one real coexistence onboarding end to end against a
test app and confirm the `history`, `smb_message_echoes` and
`smb_app_state_sync` payloads match what this code expects. Treat that as
a launch gate, not a formality.
