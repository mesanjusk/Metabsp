# Removal of the unofficial WhatsApp Web transport (Baileys)

The product now sends and receives **only** through Meta's official WhatsApp
Cloud API. The Baileys-based transport — QR-code pairing against WhatsApp Web,
free-form blasts to recipient lists, and the endpoints built on it — is gone.

This was the largest Platform Terms exposure in the codebase, and
`PRODUCTION_CHECKLIST.md` had already flagged it as a business decision to
make before onboarding any Tech-Provider-branded customer. Removing it settles
that decision rather than deferring it.

## What was deleted

| Path | Role |
|---|---|
| `backend/bulk/services/baileysService.js` | The WhatsApp Web socket client |
| `backend/bulk/services/baileysAuthState.js` | Session credential persistence |
| `backend/bulk/controllers/baileysController.js` | QR / inbox / rules / logs endpoints |
| `backend/bulk/routes/baileysRoutes.js` | `/api/bulk/baileys/*` |
| `backend/bulk/middleware/baileysGate.js` | Per-org feature gate |
| `backend/bulk/models/BaileysAuthState.js` | Stored pairing credentials |
| `backend/bulk/models/BaileysMessage.js` | Message log for that transport |
| `frontend/src/pages/WhatsAppPage.jsx` | 2,984-line QR/bulk UI at `/whatsapp-bulk` |
| `frontend/src/Components/whatsappCloud/BaileysPanel.jsx` | QR connect panel |
| `frontend/src/Components/whatsappCloud/WhatsappProviderDialog.jsx` | "Which provider?" prompt |
| `backend/__tests__/baileysGate.test.js` | Tests for the deleted gate |

`@whiskeysockets/baileys` is removed from `backend/package.json`.

## Behaviour that changed, and why

Three capabilities existed **only** because the transport was unofficial. The
Cloud API cannot reproduce them, so they are gone rather than stubbed:

**Free-form blasts to a recipient list.** Outside Meta's 24-hour customer
service window only an approved template may be sent. `POST /campaigns/:id/send`
(both the Metabsp and bulk routes) now returns `501` with a message pointing at
`POST /api/whatsapp/broadcast`, which enqueues per-recipient template jobs
through BullMQ and respects Meta's rate limits.

**Bulk send on the External API.** `POST /api/v1/baileys/send-bulk` looped over
recipients with a `sleep()`. Broadcasting is a queue operation now.

**Group messaging.** `getGroups` listed WhatsApp Web groups. The Cloud API has
no group messaging; the endpoint returns `501`.

## What was ported rather than dropped

**The External API (`/api/v1`)** kept its purpose and moved to the Cloud API:

| Was | Now |
|---|---|
| `GET /api/v1/baileys/status` | `GET /api/v1/status` |
| `POST /api/v1/baileys/send` | `POST /api/v1/send-text` |
| `POST /api/v1/baileys/send-image` | `POST /api/v1/send-image` |
| `POST /api/v1/baileys/send-text` | `POST /api/v1/send-text` |
| `POST /api/v1/baileys/send-bulk` | *(removed — use `/api/whatsapp/broadcast`)* |
| — | `POST /api/v1/send-template` *(new)* |

API-key authentication is unchanged, and every route still resolves the account
from the key's own user, so a key can only act on the number its owner
connected.

**Signup/reset OTP** (`backend/bulk/services/otpService.js`) sent a plain text
message over the WhatsApp Web session. It now uses the same
authentication-category template as `backend/src/services/otpService.js`. This
is strictly more correct: a first-time registrant has no open 24-hour window,
so a free-form text was being rejected by the Graph API anyway.

## Database — nothing destructive

No migration is required, and no customer data is deleted.

| Field | Decision |
|---|---|
| `Organization.baileysEnabled` | Removed from the schema. Existing documents keep the key; Mongoose ignores unknown fields, so nothing breaks and nothing is rewritten. |
| `User.whatsappProviderPreference` | Enum dropped, field kept. Existing rows may still read `baileys`/`both`; nothing consults it to pick a transport any more. |
| `baileysauthstates` collection | Left in place. It holds WhatsApp Web pairing credentials that are now unusable. **Drop it manually once you are satisfied with the migration** — see below. |
| `baileysmessages` collection | Left in place. Historical message log. Drop or archive at your discretion. |
| `Campaign` documents | Untouched, including `SCHEDULED` ones. The 60-second poller that fired them is gone, so they simply do not fire; they are not cancelled or deleted. |

Two collections hold data that can no longer be used. Dropping them is safe but
irreversible, so it is left as a deliberate manual step:

```js
// Only after confirming the deployment is stable.
db.baileysauthstates.drop();   // unusable WhatsApp Web pairing credentials
// db.baileysmessages.drop();  // historical log — archive first if you want it
```

`baileysauthstates` is the one worth prioritising: it stores live session
credentials for an unofficial client, which is exactly the kind of material you
do not want sitting in a production database after the feature is gone.

## Verifying the removal

```bash
# Zero runtime references. The only matches are explanatory comments in
# externalApi.js, WhatsAppCloud.js and bulk/models/User.js recording why a
# contract changed.
grep -rni "baileys" backend/src backend/bulk frontend/src nextjs --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"

# Not installed
ls backend/node_modules/@whiskeysockets 2>/dev/null   # → no such directory
```
