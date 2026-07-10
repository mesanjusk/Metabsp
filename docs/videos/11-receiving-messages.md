# 11 — Receiving Messages and Webhook Delivery

## 1. Title & Target Audience
**Title:** Receiving Messages and Webhook Delivery
**Audience:** New customer (this doubles as a Meta App Review evidence recording for inbound `whatsapp_business_messaging`)
**Estimated runtime:** 5-7 min

## 2. Learning Objective
After watching, a viewer understands how an inbound WhatsApp message reaches Metabsp and shows up live in the inbox, without any manual step on their part.

## 3. Prerequisites
- A connected WhatsApp Cloud API number with its webhook subscribed (this happens automatically at connect time).
- A second phone able to send a WhatsApp message to the connected number.

## 4. Hook / Cold Open
"You never have to configure anything to start receiving messages — it's already wired up the moment you connect a number. Let's send a message from a real phone and watch it arrive."

## 5. On-Screen Setup
- Logged in on `/whatsapp` → Meta tab → Chats, dashboard visible and idle.
- A second phone with WhatsApp, ready to send a message to the connected business number.

## 6. Step-by-Step Walkthrough
1. **Narration:** "When you connected this number, the app automatically subscribed itself to receive webhooks for it — that's a one-time step Meta requires per WABA, and it's handled for you."
   **On screen:** Point at the account's connected status in `WhatsAppNumbersPanel`.
2. **Narration:** "Now I'll send a message from a real phone to this business number."
   **On screen:** On the second phone, send a WhatsApp text message to the connected number.
3. **Narration:** "Meta delivers that message to our webhook endpoint. We verify it's genuinely from Meta using an HMAC signature check before doing anything else with it."
   **On screen:** (Narration only — this happens server-side, not visibly on screen.)
4. **Narration:** "We acknowledge Meta's delivery immediately, then process the message in the background — that's why this appears here within a second or two, without you refreshing anything."
   **On screen:** Watch the message appear live in the Chats inbox via the socket connection.
5. **Narration:** "The contact is created or updated automatically the first time they message you, and if you've registered your own outbound webhook destinations, this same event fans out to your own systems too."
   **On screen:** Show the contact now appearing in the CRM tab; briefly mention `WebhookDestinationsPanel` as the place to see this (covered fully in video 14).

## 7. Common Mistakes / Pitfalls
- Assuming a new WABA receives webhooks automatically without ever connecting it through this app — the automatic subscription only happens as part of Embedded Signup or manual connect here.
- Testing from a number that's the business number itself, rather than a genuinely separate customer-side phone.
- Expecting instant delivery if the account's webhook signature enforcement is misconfigured — a bad `META_APP_SECRET` silently rejects every inbound delivery with a 403 on Meta's side.

## 8. Troubleshooting Callout
If messages simply aren't arriving, confirm the account's `webhookSubscribed` flag is true and that `WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE`/`META_APP_SECRET` are correctly configured — a signature mismatch causes Meta to see failed deliveries in its own Webhooks diagnostics panel, invisible from inside this app unless you check Meta's side too. See `docs/meta-tech-provider/TROUBLESHOOTING.md` under "Webhook not receiving messages" and `docs/meta-tech-provider/WEBHOOK_SETUP.md`.

## 9. Summary / Recap
"Receiving is automatic from the moment you connect a number — subscribed at connect time, verified by signature, acknowledged fast, and shown live in your inbox."

## 10. Call to Action & Related Resources
Continue to **12 — Managing Contacts and Imports**. Related reading: `docs/meta-tech-provider/WEBHOOK_SETUP.md`, `docs/api/WEBHOOKS.md`.
