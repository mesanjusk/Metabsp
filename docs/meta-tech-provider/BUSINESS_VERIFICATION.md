# Meta Business Verification

Business Verification is a Meta-side process against your **Meta Business
Manager** account, not something this codebase performs — there is no API
this app calls to verify a business. This doc explains what it is, why the
platform needs it, and what to have ready.

## Why it's required

Without a verified business, Meta caps your WhatsApp messaging tier low
(typically limited to a small number of unique conversations per rolling
24h) and will not grant the permissions this app needs
(`whatsapp_business_management`, `whatsapp_business_messaging`) for
production App Review. A BSP serving multiple customer businesses needs
verification on **its own** Business Manager — the one whose System User
and app own the Embedded Signup configuration this app uses
(`META_EMBEDDED_SIGNUP_CONFIG_ID` in `backend/.env.example`).

## What Meta checks

1. **Legal business name and address** matching official registration
   documents (certificate of incorporation, business license, or
   equivalent for your jurisdiction).
2. **A working business phone number and website domain** you control
   (Meta may call the number or check for a domain-verification TXT
   record/meta tag).
3. **A named business representative** with authority to confirm details.

## Where to do it

Meta Business Manager → Business Settings → Security Center → Start
Verification. This is entirely inside Meta's own console — this repo has
no code path that touches it.

## What depends on it in this app

- `META_APP_ID` / `META_APP_SECRET` (`backend/.env.example`) belong to an
  app under this verified Business Manager.
- The Embedded Signup configuration
  (`META_EMBEDDED_SIGNUP_CONFIG_ID`) is created under the same verified
  Business Manager and is what `frontend/src/utils/facebookSdk.js`'s
  `loadFacebookSdk`/`FB.login()` call references.
- Higher messaging tiers (more unique conversations per day across all
  connected customer numbers) unlock as verification + a track record of
  good quality ratings accumulate — this is a per-WABA Meta policy, not
  something this app's code influences.

## Practical timeline

Business Verification typically takes anywhere from same-day to a couple
of weeks depending on how quickly Meta can confirm the submitted documents
and how clean the business's public footprint (website, registered
address) is. Budget for this **before** scheduling an App Review
submission — App Review reviewers will check verification status as part
of approving the sensitive WhatsApp permissions.

## Common rejection reasons (and how to avoid them)

- Business name in Business Manager doesn't exactly match legal documents
  — align them before submitting, not after a rejection.
- No working website at the domain being verified — have a live,
  reachable site before submitting domain verification.
- Business phone number that doesn't match any listed record — use the
  number actually registered with your business registration authority.
