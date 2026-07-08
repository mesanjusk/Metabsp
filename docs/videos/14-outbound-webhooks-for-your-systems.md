# 14 — Setting Up Outbound Webhooks for Your Own Systems

## 1. Title & Target Audience
**Title:** Setting Up Outbound Webhooks for Your Own Systems
**Audience:** Developer / technical customer
**Estimated runtime:** 6-8 min

## 2. Learning Objective
After watching, a developer can register a webhook destination, receive inbound-message and contact events in their own system, and verify each delivery's signature.

## 3. Prerequisites
- A connected WhatsApp number.
- A publicly reachable URL in your own system to receive webhook POST requests (or a tunneling tool like ngrok for a local demo).
- Basic comfort reading Node.js.

## 4. Hook / Cold Open
"Want your CRM or support desk to know the instant a customer messages you, without polling? This is this platform's own outbound webhook system — not to be confused with Meta's webhook into us."

## 5. On-Screen Setup
- Logged in on `/whatsapp` → Meta tab → Settings, scrolled to the Webhook destinations panel.
- A local test server or webhook-testing endpoint running and reachable.

## 6. Step-by-Step Walkthrough
1. **Narration:** "This is different from Meta's webhook into this platform — this is our own outbound fan-out, for connecting your own systems to a customer's WhatsApp activity."
   **On screen:** `WebhookDestinationsPanel.jsx`.
2. **Narration:** "Add a destination — give it a label and your target URL."
   **On screen:** Fill in label + URL, click Add (`POST /api/whatsapp/webhook-destinations`).
3. **Narration:** "You'll get a generated secret for this destination — you'll need it to verify deliveries are genuinely from us."
   **On screen:** Reveal/copy the generated secret.
4. **Narration:** "Three event types come through: any inbound WhatsApp message, `contact.upserted` when a contact is created or updated, and `contact.deleted`."
   **On screen:** Point at the events documented in the panel or reference `docs/api/WEBHOOKS.md`.
5. **Narration:** "Every delivery includes a signature header — compute the same HMAC-SHA256 over the raw body using your destination's secret, and compare using a constant-time comparison, never a plain string equality check."
   **On screen:** Show the verification snippet from `docs/api/SDK_EXAMPLES.md` running against a real delivery.
   ```js
   const crypto = require('crypto');
   function isValidMetabspWebhook(rawBody, signatureHeader, destinationSecret) {
     const expected = 'sha256=' + crypto.createHmac('sha256', destinationSecret).update(rawBody).digest('hex');
     try { return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected)); }
     catch { return false; }
   }
   ```
6. **Narration:** "The panel tracks delivery health per destination — last attempt, last status, last error — so you can see if deliveries are failing without building your own dead-letter tooling."
   **On screen:** Point at the "Delivering OK" / "Failed" status chip and the error detail text.

## 7. Common Mistakes / Pitfalls
- Comparing signatures with `===` instead of a constant-time comparison — this leaks timing information an attacker could exploit.
- Forgetting that bulk contact imports do not fan out one event per row — poll `GET /api/whatsapp/contacts` instead for syncing a bulk import.
- Registering a destination URL that isn't publicly reachable yet, then wondering why every delivery shows "Failed."

## 8. Troubleshooting Callout
If a destination consistently shows "Failed," check `lastError` in the panel first — most failures are a non-2xx response or an unreachable URL on your own server, not a platform-side issue. Deliveries retry with backoff automatically, so a transient outage on your end will usually self-heal without any action here.

## 9. Summary / Recap
"Register a destination, verify signatures with a constant-time comparison, and watch delivery health right in the panel — that's the full loop for connecting your own systems to real-time WhatsApp events."

## 10. Call to Action & Related Resources
Continue to **15 — The External API and API Keys**. Related reading: `docs/api/WEBHOOKS.md`, `docs/api/SDK_EXAMPLES.md`.
