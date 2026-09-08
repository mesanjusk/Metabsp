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

1. **`GET /api/whatsapp/connect/config`**
   (`nextjs/app/api/whatsapp/connect/config/route.ts`) returns
   `coexistenceEnabled`, `featureType` and `sessionInfoVersion` alongside
   the existing `appId`/`configId`/`apiVersion`. Coexistence is on unless
   `META_ENABLE_COEXISTENCE=false`.
2. **`FB.login` extras** — `connectWithMeta` in
   `nextjs/lib/ui/hooks/useWhatsAppConnection.js` passes:
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
   `nextjs/lib/client/facebookSdk.js` resolves on
   `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` in addition to `FINISH` and
   `FINISH_ONLY_WABA`, and returns a `coexistence` boolean (also inferred
   from a `FINISH` whose `data.current_step` names the WhatsApp Business
   app screen).
4. **Server-side exchange and validation** —
   `nextjs/app/api/whatsapp/embedded-signup/exchange-code/route.ts` treats
   every browser-supplied value (`wabaId`, `phoneNumberId`, `businessId`,
   `coexistence`) as a *hint* and re-derives the truth from Meta
   (`nextjs/lib/whatsapp/metaOnboarding.ts`):
   - exchanges the `code` for the Business Integration System User (BISU)
     token — for a v4 configuration this is already the long-lived business
     token, so the old `fb_exchange_token` step is **not** run;
   - `debug_token` confirms the token is valid, belongs to **this** Meta app
     (`app_id === META_APP_ID`), and carries the required WhatsApp scopes;
     a token minted for another app is rejected;
   - the WABA id is resolved from the browser hint cross-checked against the
     token's granular scopes (`whatsapp_business_management` /
     `whatsapp_business_messaging` `target_ids`), or derived from them when
     the browser named none;
   - the phone number is discovered via `GET /{waba-id}/phone_numbers` (which
     also returns `platform_type`, `display_phone_number`, `verified_name` in
     one call). A browser-reported id is honoured only if it is actually on
     the WABA; when absent, a single number is used, and several numbers are
     refused rather than guessed — except that a single `SMB_APP` candidate is
     selected under a coexistence hint.
   The account is stored as `connectionMode: 'coexistence'` when *either* the
   browser reported a coexistence finish *or* the resolved number's
   `platform_type` is `SMB_APP` — so a tampered client flag alone cannot
   mislabel an ordinary Cloud API number, and a coexistence completion that
   omits the phone number id still onboards.

`sessionInfoVersion` is read from `META_ES_SESSION_INFO_VERSION` (default
`3`) so it can be changed without a code deploy — but see **Embedded Signup
v4** below before changing it: the number alone is not the migration.

## The three coexistence webhooks

These arrive on the **same** `/webhook` endpoint as ordinary `messages`
events, distinguished by `entry[].changes[].field`. A Cloud-API-only
integration never sees them, and — this is the part that silently breaks
coexistence deployments — an integration that doesn't handle them will
happily onboard a number and then show an empty, permanently stale inbox.

Handled by `nextjs/lib/whatsapp/coexistence.ts` (there is no separate
`coexistenceService.ts`; the Express service of that name went with the
consolidation):

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
- Imported messages do **not** emit a `new_message` socket event. A
  backfill saves thousands of messages one at a time; emitting each would
  flood every open inbox and announce three-month-old messages as new.
  One `history_sync_progress` event is emitted per chunk instead
  (`nextjs/lib/socket/emitter.ts`).

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

**Status: check it, do not assume it.** An earlier revision of this
document recorded all four fields as confirmed subscribed on 2026-08-25.
That snapshot cannot be trusted now — the dashboard may have changed, and
while `META_ENABLE_COEXISTENCE` is false the boot log proves only that
`messages` is subscribed, because that is all it requires.

`nextjs/lib/services/preflightCheckService.ts` reads the live answer on
every boot and via `GET /api/whatsapp/preflight` (authenticated), by
calling `GET /{app-id}/subscriptions` with an app access token. Read
`webhook_fields.notReadyForCoexistence` in that response: it lists exactly
which of the three coexistence fields are missing. An empty array is the
green light to flip the flag; anything else means coexistence numbers
would onboard and then silently drop history, echoes and contacts.

Webhook **field** subscriptions can only be *set* app-level in Meta's
dashboard — there is no Graph API call this repo can make to set them per
WABA, which is why the pre-flight check reads them rather than fixing them.
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

### Graph API version and JS SDK version (separate knobs)

Two version concerns are now split (`nextjs/lib/config/graphApi.ts`):

- **`WHATSAPP_API_VERSION`** — every server-side Graph call: the OAuth code
  exchange, `debug_token`, phone-number discovery, the WABA subscription,
  sending, media downloads. Pinned to `v23.0`; the deploy gate
  (`scripts/meta-deploy-check.js`) refuses anything below that baseline. Treat
  a bump as a change affecting every Graph call — re-test send/receive.
- **`META_JS_SDK_VERSION`** — only the version the browser passes to `FB.init`
  for the Embedded Signup popup, served via `GET /api/whatsapp/connect/config`
  as `sdkVersion`. Meta's Embedded Signup Builder can move the SDK version
  ahead of the Graph version, and there is no reason to tie the two together.
  Falls back to `WHATSAPP_API_VERSION` when unset, so a single-version
  deployment keeps working.

Both default to `v23.0`. Set `META_JS_SDK_VERSION` explicitly to match the
current Meta Builder output when it moves ahead.

## Embedded Signup v4

**Context:** Meta deprecates Embedded Signup v2 on 15 October 2026, and the
`coex` feature type does not migrate automatically. The Meta-side
configuration for this app is now an Embedded Signup **v4** configuration
(ES Version v4, Session Info Version 3) with Coexistence enabled, and this
repository targets it.

What the browser sends (`nextjs/lib/ui/hooks/useWhatsAppConnection.js`) is the
config-driven Facebook Login for Business launch:

```js
FB.login(callback, {
  config_id: CONFIG_ID,                 // META_EMBEDDED_SIGNUP_CONFIG_ID
  response_type: 'code',
  override_default_response_type: true,
  extras: {
    setup: {},
    sessionInfoVersion: '3',            // META_ES_SESSION_INFO_VERSION
    featureType: 'whatsapp_business_app_onboarding', // when coexistence is on
  },
})
```

- `sessionInfoVersion` is **retained** because Meta's current Builder output
  for this configuration still reports Session Info Version = 3; it is passed
  from `META_ES_SESSION_INFO_VERSION` and omitted only if that is cleared.
- `featureType` is **not** dropped for v4. It is what selects the WhatsApp
  Business app (coexistence) path and is passed additively whenever
  coexistence is enabled — a customer with no Business app still runs the
  ordinary Cloud API path in the same popup.
- The `WA_EMBEDDED_SIGNUP` completion messages are parsed in
  `nextjs/lib/client/facebookSdk.js`, which handles `FINISH`,
  `FINISH_ONLY_WABA`, `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`, `CANCEL` and
  `ERROR`, under strict exact-origin validation.

The dead `META_ES_VERSION` key (which no code ever read) has been removed from
`render.yaml` and `.env.example`.

**The popup launches directly from the user's consent click.** The Embedded
Signup config and the Facebook SDK are preloaded (on dashboard mount and again
when the consent dialog opens), so `FB.login` runs from the gesture rather than
after a network fetch or script load — modern browsers block a popup opened
after intervening async work as unsolicited.

**Server-side, the browser is not trusted.** See step 4 of the onboarding flow
above: the code is exchanged for a BISU token, `debug_token` validates it
against this app and its scopes, and the WABA + phone number are re-derived and
validated against Meta before anything is persisted.

Before relying on this commercially, still run one real coexistence onboarding
end to end (see the launch gate at the end of this document).

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
- Standard Business Verification is not available for a coexistence number
  either. The routes reported for these customers are Partner-Led Business
  Verification or Meta Verified for Business — which changes how you
  onboard them, so settle it before you sell coexistence rather than after
  a customer is stuck.
- Throughput is lower than a dedicated Cloud API number, which matters
  for large broadcasts.
- The customer must open the Business app periodically to keep the link
  alive.

Verify each of these against Meta's current documentation before quoting
them to a customer.

## What has and has not been verified here

Verified in this repository: the webhook parsing and persistence for all
three fields, including direction derivation, de-duplication, the
"history does not emit live message events" rule and the "removal is not
a delete" rule — see `nextjs/tests/coexistence.test.ts`.

This claim was false for a while and is worth saying plainly: the tests it
used to cite lived at `backend/__tests__/coexistenceWebhook.test.js` and
were deleted with the Express codebase during the consolidation. Nothing
replaced them until `nextjs/tests/coexistence.test.ts`, so coexistence
shipped untested while this document said otherwise. The 24-hour window
rule is covered separately in `nextjs/tests/twentyFourHourGuard.test.ts`.

**Not** verified: live traffic from a real, App-Review-approved Meta
Business app. The payload shapes here follow Meta's documented structure
and are parsed defensively (an unrecognised shape yields no events rather
than throwing inside the webhook handler), but before relying on this
commercially, run one real coexistence onboarding end to end against a
test app and confirm the `history`, `smb_message_echoes` and
`smb_app_state_sync` payloads match what this code expects. Treat that as
a launch gate, not a formality.
