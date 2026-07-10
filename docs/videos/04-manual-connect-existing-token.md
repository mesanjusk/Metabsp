# 04 — Manual Connect with an Existing Token

## 1. Title & Target Audience
**Title:** Manual Connect with an Existing Token
**Audience:** New customer (technical) / developer
**Estimated runtime:** 5-7 min

## 2. Learning Objective
After watching, a viewer can connect a WhatsApp number to Metabsp by pasting an existing Meta access token, as an alternative to the Embedded Signup popup.

## 3. Prerequisites
- A Metabsp account.
- An existing Graph API access token, phone number ID, and WABA/business account ID from Meta Business Manager (for example, generated while testing in a Meta developer app).

## 4. Hook / Cold Open
"Already have a token from Meta Business Manager, or can't use the Embedded Signup popup in your environment? This is the manual path — same validation, same webhook subscription, no popup required."

## 5. On-Screen Setup
- Logged into Metabsp on `/whatsapp`, Settings view.
- A valid access token, phone number ID, and business/WABA ID copied and ready to paste (values redacted/blurred on screen for recording).

## 6. Step-by-Step Walkthrough
1. **Narration:** "Click 'Connect manually' instead of 'Connect with Meta.'"
   **On screen:** `WhatsAppAttendanceSettings.jsx`'s "Connect manually" button opens the manual-connect dialog in `WhatsAppCloudDashboard.jsx`.
2. **Narration:** "Paste your access token, phone number ID, and business account ID or WABA ID."
   **On screen:** Fill the form fields (`manualForm` state: accessToken, phoneNumberId, businessAccountId, wabaId, displayPhoneNumber, verifiedName).
3. **Narration:** "Before anything is saved, we validate this token actually works — calling `/me` and the phone number endpoint on Meta's Graph API. If the token is invalid, expired, or missing the right permissions, you'll see the real error Meta returned rather than a generic failure."
   **On screen:** Submit the form; show a successful validation completing.
4. **Narration:** "Same as Embedded Signup, this also subscribes the app to your WABA's webhooks automatically — you don't need a separate step."
   **On screen:** Connected-account banner appears; `WhatsAppNumbersPanel` shows the new entry.
5. **Narration:** "This is also how you'd reconnect a number whose token has gone bad, or update credentials for an account created by an admin."
   **On screen:** Point to the "Reconnect" button as the equivalent path for an already-connected-but-broken account.

## 7. Common Mistakes / Pitfalls
- Pasting a token that lacks `whatsapp_business_management` scope — validation will reject it with Meta's own error message.
- Using a phone number ID that belongs to a different Meta asset than the token can access.
- Assuming this bypasses webhook setup — it doesn't; subscription still happens automatically, but `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and `META_APP_SECRET` still need to be configured correctly on the backend for deliveries to succeed.

## 8. Troubleshooting Callout
A 400 error here means the token itself is invalid or expired, lacks the required scope, or the phone number ID doesn't belong to the token's accessible assets — the validation service surfaces Meta's own Graph API error message rather than hiding it. Read that message directly rather than guessing. See `docs/meta-tech-provider/TROUBLESHOOTING.md` under "Manual connect rejects a valid-looking token."

## 9. Summary / Recap
"Manual connect gives you the same result as Embedded Signup — a validated, encrypted, webhook-subscribed account — using a token you already have instead of the popup flow."

## 10. Call to Action & Related Resources
Continue to **05 — Understanding Roles and the Team Inbox**. Related reading: `docs/meta-tech-provider/OAUTH.md`, `docs/meta-tech-provider/ACCESS_TOKENS.md`.
