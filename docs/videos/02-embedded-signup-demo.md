# 02 — Connecting WhatsApp with Embedded Signup

## 1. Title & Target Audience
**Title:** Connecting WhatsApp with Embedded Signup
**Audience:** New customer
**Estimated runtime:** 6-8 min

## 2. Learning Objective
After watching, a viewer can connect their own WhatsApp Business Account to Metabsp using Meta's Embedded Signup popup, without ever handing Metabsp their Meta password.

## 3. Prerequisites
- A Metabsp account (see video 01).
- A Meta Business Manager account with a WhatsApp Business Account (WABA) already set up, or willingness to create one during the flow.
- Admin access to that Business Manager (Embedded Signup asks the connecting user to confirm asset ownership).

## 4. Hook / Cold Open
"This is the same 'Connect with Meta' flow Meta itself recommends for WhatsApp Business Solution Providers — your credentials never touch our servers. Let's connect a real number."

## 5. On-Screen Setup
- Logged into Metabsp, on `/whatsapp`, no account connected yet.
- Browser popup-blocker disabled for this domain (Embedded Signup opens a real popup window).
- A Meta test/business account ready to log into when the popup appears.

## 6. Step-by-Step Walkthrough
1. **Narration:** "On the WhatsApp dashboard's Settings view, click 'Connect with Meta.'"
   **On screen:** `WhatsAppAttendanceSettings.jsx`'s "Connect with Meta" button.
2. **Narration:** "This loads Facebook's own JavaScript SDK and opens Meta's signup popup — you'll log into your Meta Business account here, not ours."
   **On screen:** The Embedded Signup popup opens; log in and select the Business/WABA/phone number to connect.
3. **Narration:** "Two things happen at once: Meta's popup returns an authorization code through its own callback, and separately posts your WABA ID, phone number ID, and business ID back to this page via a secure postMessage event."
   **On screen:** Popup completes and closes automatically.
4. **Narration:** "Behind the scenes, our server exchanges that code for a token — first a short-lived one, then a long-lived token valid roughly 60 days — validates the WABA and phone number IDs are real numeric Meta IDs, and subscribes this app to receive webhooks for your number automatically."
   **On screen:** Loading state on the dashboard, then the connected-account banner appears with the verified business name and phone number.
5. **Narration:** "That's it — no manual token pasting, no webhook configuration on your end."
   **On screen:** `WhatsAppNumbersPanel` now lists the newly connected number as active.

## 7. Common Mistakes / Pitfalls
- Blocking the popup in the browser — the flow depends on it opening.
- Not being an admin/asset-owner on the Business Manager side — Meta will reject the asset selection.
- Assuming this works without `META_EMBEDDED_SIGNUP_CONFIG_ID` configured on the backend — if that's missing, the app falls back to the manual-connect dialog instead.

## 8. Troubleshooting Callout
If the popup opens but never returns a WABA ID / phone number ID, check `META_EMBEDDED_SIGNUP_CONFIG_ID` is set correctly and check the browser console for Facebook SDK load errors — `listenForEmbeddedSignupData` only trusts postMessage events from an origin ending in `facebook.com`, so a blocked or failed SDK load means it simply never fires. See `docs/meta-tech-provider/TROUBLESHOOTING.md` under "Connect with Meta fails or hangs."

## 9. Summary / Recap
"Your WhatsApp number is connected, its webhook is subscribed automatically, and your token is encrypted at rest. Next we'll cover the alternative path — manual connect — for when you already have a token from Meta Business Manager."

## 10. Call to Action & Related Resources
Continue to **04 — Manual Connect with an Existing Token**. Related reading: `docs/meta-tech-provider/EMBEDDED_SIGNUP.md`, `docs/meta-tech-provider/OAUTH.md`, `docs/meta-tech-provider/REQUIRED_PERMISSIONS.md`.
