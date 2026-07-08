# 13 — System User Tokens for Long-Lived Access

## 1. Title & Target Audience
**Title:** System User Tokens for Long-Lived Access
**Audience:** Admin / developer (account owner responsible for production reliability)
**Estimated runtime:** 6-8 min

## 2. Learning Objective
After watching, a viewer can generate a Business-owned System User token in Meta Business Manager and attach it to a connected WhatsApp number in Metabsp, removing the dependency on one person's personal Meta login.

## 3. Prerequisites
- Admin access to the Meta Business Manager account that owns the WABA.
- A WhatsApp number already connected to Metabsp via Embedded Signup or manual connect.

## 4. Hook / Cold Open
"If the number that logged into Meta to connect your WhatsApp account ever changes their password or leaves the company, your customer number goes down — unless you're using a System User token. Here's how to set one up."

## 5. On-Screen Setup
- Meta Business Manager open, logged in as a Business admin.
- Metabsp open on `/whatsapp` → Meta tab → Settings, with a connected number visible in `WhatsAppNumbersPanel`.

## 6. Step-by-Step Walkthrough
1. **Narration:** "There's no API for this — it's a one-time manual step in Meta Business Manager, done by the Business owner."
   **On screen:** Meta Business Manager → Business Settings → Users → System Users → Add.
2. **Narration:** "Create a System User with the Admin role — that's needed to manage WhatsApp assets."
   **On screen:** Fill in the System User creation form.
3. **Narration:** "Assign your WhatsApp Business Account to this System User with Full Control."
   **On screen:** Add asset → select the WABA → Full Control.
4. **Narration:** "Generate a new token — select the same app whose App ID and secret this backend uses, choose `whatsapp_business_management` and `whatsapp_business_messaging` permissions, and set expiration to Never."
   **On screen:** System User → Generate New Token → select app and permissions → Never expire.
5. **Narration:** "Meta shows you this token exactly once — copy it now."
   **On screen:** Copy the generated token (blur/redact on screen).
6. **Narration:** "Back in Metabsp, open the numbers panel and click 'System User token' next to the connected account."
   **On screen:** `WhatsAppNumbersPanel.jsx` → "System User token" button opens the form.
7. **Narration:** "Paste the token in — before saving, we verify it actually works against this phone number."
   **On screen:** Paste token (and optional System User ID), submit.
8. **Narration:** "Once saved, this account shows a 'System User token' badge, and it's excluded from the daily automatic token-refresh cycle — since System User tokens set to never expire don't need re-exchanging."
   **On screen:** Point at the chip/badge on the account card.

## 7. Common Mistakes / Pitfalls
- Creating the System User with a role other than Admin — it won't have permission to manage WhatsApp assets.
- Forgetting to select "Never" for token expiration, defeating the purpose of using a System User token at all.
- Not saving the token immediately — Meta only displays it once.

## 8. Troubleshooting Callout
If the token is rejected when pasted into Metabsp, the platform actually calls a live health check against your connected phone number before storing it — a failure there usually means the wrong permissions were selected during token generation, or the WABA wasn't actually assigned to that System User with Full Control. See `docs/meta-tech-provider/SYSTEM_USER_CREATION.md`.

## 9. Summary / Recap
"A System User token belongs to your Business, not to one employee's Meta login — set every production number to use one before you scale past a handful of customers."

## 10. Call to Action & Related Resources
Continue to **14 — Setting Up Outbound Webhooks for Your Own Systems**. Related reading: `docs/meta-tech-provider/SYSTEM_USER_CREATION.md`, `docs/meta-tech-provider/ACCESS_TOKENS.md`.
