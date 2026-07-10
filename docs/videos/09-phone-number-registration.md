# 09 — Connecting and Managing Additional WhatsApp Numbers

## 1. Title & Target Audience
**Title:** Connecting and Managing Additional WhatsApp Numbers
**Audience:** New customer / developer (this doubles as a Meta App Review evidence recording)
**Estimated runtime:** 6-8 min

## 2. Learning Objective
After watching, a viewer can connect a second WhatsApp number to the same Metabsp account, view its phone number details and templates, and confirm its webhook subscription — demonstrating the `whatsapp_business_management` and `business_management` permissions in real use.

## 3. Prerequisites
- An existing Metabsp account with at least one WhatsApp number already connected.
- A second, already-registered WhatsApp Business number's access token, phone number ID, and business/WABA ID (this app connects already-registered numbers only — it does not provision brand-new numbers with Meta).

## 4. Hook / Cold Open
"This platform supports more than one WhatsApp number per account — different brands, different departments, whatever your business needs. Here's how to add a second number and see exactly what data we read from Meta to manage it."

## 5. On-Screen Setup
- Logged in on `/whatsapp` → Meta tab → Settings, with one active connected number already visible.
- Credentials for a second, already-registered number ready to paste.

## 6. Step-by-Step Walkthrough
1. **Narration:** "In the numbers panel, click 'Connect another number.'"
   **On screen:** `WhatsAppNumbersPanel.jsx`'s "Connect another number" button.
2. **Narration:** "I'll use manual connect for this one, since it's already registered with an existing token from Meta Business Manager."
   **On screen:** Manual-connect dialog opens; paste accessToken, phoneNumberId, businessAccountId/wabaId.
3. **Narration:** "Before saving, the app calls Meta's Graph API to list the WABAs this token's Business Manager actually owns, confirming the business account is real and accessible — this is the `business_management` permission in action."
   **On screen:** Validation completes successfully.
4. **Narration:** "Once connected, we read the phone number's real details straight from Meta — its display phone number and verified business name — and list its approved templates."
   **On screen:** Show the new account's card in `WhatsAppNumbersPanel` with `displayPhoneNumber`/`verifiedName`, then switch to the Templates sub-tab to show the template list pulled live from `GET /api/whatsapp/templates`.
5. **Narration:** "The app also subscribes itself to this WABA's webhooks automatically at connect time, so this number starts receiving messages immediately — no manual step."
   **On screen:** Point to the account showing as active with no separate webhook-configuration step required.
6. **Narration:** "Only one number is 'active' at a time per user session — switch between them here without disconnecting either."
   **On screen:** Click "Activate" on the first number to switch back, showing the toggle between the two.

## 7. Common Mistakes / Pitfalls
- Assuming this registers a brand-new phone number with Meta — it doesn't; this app connects numbers that are already registered on WhatsApp Business elsewhere.
- Forgetting a number already active on consumer WhatsApp, the WhatsApp Business App, or another BSP needs Meta's own number-migration/PIN-transfer process completed first, entirely outside this app, before it can be connected here.
- Expecting more than one number active simultaneously for the same user session — only one is active at a time, though all connected numbers remain available to switch to.

## 8. Troubleshooting Callout
If a customer mentions their number is "already on WhatsApp" elsewhere, point them to Meta's own number-migration/2-step-verification process first — this platform has no separate migration mode; once released on Meta's side, it connects through the exact same flow as any other number. See `docs/meta-tech-provider/CUSTOMER_ONBOARDING.md` under "Migrating a number that's already on WhatsApp elsewhere."

## 9. Summary / Recap
"Connecting an additional number reuses the same validated, encrypted, auto-subscribed flow as your first — with the account switcher letting you manage several numbers from one login."

## 10. Call to Action & Related Resources
Continue to **10 — Sending Text and Template Messages**. Related reading: `docs/meta-tech-provider/CUSTOMER_ONBOARDING.md`, `docs/meta-tech-provider/REQUIRED_PERMISSIONS.md`.
