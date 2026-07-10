# Required Graph API permissions

| Permission | Used for | Where in this codebase |
|---|---|---|
| `whatsapp_business_management` | Reading/managing WABA assets: phone number details, template list, subscribing the app to webhooks | `whatsappCredentialValidationService.js`, `subscribeAppToWaba`, `getTemplates` |
| `whatsapp_business_messaging` | Sending/receiving messages, statuses, media | `dispatchTextMessage`/`dispatchTemplateMessage`/`dispatchMediaMessage`, `receiveWebhook` |
| `business_management` | Listing WABAs owned by a Business Manager during manual connect validation (`owned_whatsapp_business_accounts`) | `whatsappCredentialValidationService.js` |
| `public_profile` (default FB Login scope) | Identifying the connecting Meta user (`/me`) during Embedded Signup/manual connect validation | `completeEmbeddedSignup`, `validateManualWhatsAppCredentials` |

## What this app does **not** request

- Any Page/Instagram permission — this app is WhatsApp-only. If your Meta
  App is also used for other products, keep those permission requests in
  a separate App Review submission so a WhatsApp-specific reviewer isn't
  evaluating unrelated scope.
- `whatsapp_business_management`'s broader asset-creation scopes (e.g.
  registering brand-new phone numbers) — this app connects
  already-registered numbers only; see `EMBEDDED_SIGNUP.md`'s note on
  phone number provisioning being out of scope today.

## App Review evidence to prepare

For each permission above, Meta's reviewers expect a short screen
recording showing the exact flow that uses it — see
`docs/videos/02-embedded-signup-demo.md`,
`docs/videos/09-phone-number-registration.md`,
`docs/videos/10-sending-messages.md`, and
`docs/videos/11-receiving-messages.md` for ready-to-record scripts
covering each of these.
