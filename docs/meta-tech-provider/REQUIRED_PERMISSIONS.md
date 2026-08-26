# Required Graph API permissions

| Permission | Used for | Where in this codebase |
|---|---|---|
| `whatsapp_business_management` | Reading/managing WABA assets: phone number details, template list, subscribing the app to webhooks | `whatsappCredentialValidationService.js`, `subscribeAppToWaba`, `getTemplates` |
| `whatsapp_business_messaging` | Sending/receiving messages, statuses, media | `dispatchTextMessage`/`dispatchTemplateMessage`/`dispatchMediaMessage`, `receiveWebhook` |
| `business_management` | Listing WABAs owned by a Business Manager during manual connect validation (`owned_whatsapp_business_accounts`) | `whatsappCredentialValidationService.js` |

Request exactly these three. **Do not request `public_profile`** — see below.

## `public_profile` is deliberately not requested

An earlier revision of this table listed `public_profile` as "identifying the
connecting Meta user (`/me`) during Embedded Signup/manual connect". That was
wrong, and requesting a permission the app does not exercise is a common
rejection trigger. Meta's own usage table shows **0 lifetime API calls**, and
the code agrees:

- `completeEmbeddedSignup` (`backend/src/controllers/whatsappController.js`)
  makes exactly three Graph calls — `oauth/access_token` twice and
  `GET /{phone-number-id}`. It never calls `/me`.
- The one `/me` call in the WhatsApp path
  (`whatsappCredentialValidationService.js`) is on the **manual connect** path
  only and uses the customer's own WhatsApp token. `/me` with a system-user or
  WABA token returns that token's app-scoped ID; it does not need
  `public_profile`, which governs Facebook Login user tokens.

`backend/src/services/socialAuthService.js` does call `/me` with a Facebook
Login token, but social sign-in is a separate, undeployed feature and belongs
in its own submission. Full reasoning in `APP_REVIEW_SUBMISSION_TEXT.md`.

## Coexistence

Coexistence (`COEXISTENCE.md`) adds no new permission — it runs on
`whatsapp_business_management` + `whatsapp_business_messaging` like the
rest of the integration. What it does require is the `history`,
`smb_message_echoes` and `smb_app_state_sync` **webhook field**
subscriptions in the App Dashboard, which are configuration rather than
permissions and are not part of an App Review submission.

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
