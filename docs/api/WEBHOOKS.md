# Outbound webhooks (this platform → your system)

Not to be confused with Meta's webhook **into** this platform (see
`docs/meta-tech-provider/WEBHOOK_SETUP.md`) — this doc covers this
platform's own outbound webhook fan-out, for integrating your own system
with a customer's WhatsApp data in near-real-time.

## Registering a destination

Inside the platform: **WhatsApp Settings → Webhook destinations** (or
`POST /api/whatsapp/webhook-destinations`, JWT-authenticated, run by the
account owner). Each destination gets its own label, target URL, and a
generated HMAC secret — multiple destinations can be registered against
one connected WhatsApp number (e.g. a CRM webhook and a support-ticketing
webhook both listening to the same account).

## Events delivered

| Event | Fired when |
|---|---|
| Inbound WhatsApp message | Any message received on the connected number (the parsed payload shape Meta itself sent) |
| `contact.upserted` | A contact is created or updated (`createContact`/`updateContact` in `whatsappController.js`) |
| `contact.deleted` | A contact is deleted |

Every event is `POST`ed as JSON to your registered URL.

## Verifying authenticity

Every delivery includes:

```
X-Metabsp-Signature-256: sha256=<hex-hmac-of-raw-body-using-your-destinations-own-secret>
```

Compute the same HMAC-SHA256 over the exact raw request body using the
secret shown when you registered the destination, and compare with
`crypto.timingSafeEqual` (or your language's constant-time comparison) —
never a plain `===`/`==` string compare, which leaks timing information
an attacker could exploit to forge a valid signature byte-by-byte.

```js
const crypto = require('crypto');

function isValidMetabspWebhook(rawBody, signatureHeader, destinationSecret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', destinationSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false; // different lengths -> definitely not a match
  }
}
```

## Delivery reliability

Deliveries retry with backoff on failure (`postToWebhookDestination` in
`backend/src/controllers/whatsappController.js`); each destination tracks
`lastAttemptAt`/`lastStatus`/`lastError` so you can check delivery health
from inside the platform without needing your own dead-letter tooling.

## What's intentionally not sent this way

Bulk contact imports/bulk updates do **not** fan out one event per row —
that would spam a destination during a large import. If you need to sync
a bulk import, poll the Contacts API (`GET /api/whatsapp/contacts`)
instead of relying on webhook events for that specific case.
