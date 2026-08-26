# Meta App Review

App Review is Meta's process for approving your app to request
`whatsapp_business_management`/`whatsapp_business_messaging` for real
customer accounts beyond your own test numbers — entirely a Meta-side
review, not something this codebase automates.

The exact text to paste into each dashboard field is in
`APP_REVIEW_SUBMISSION_TEXT.md`; the permission→code mapping is in
`REQUIRED_PERMISSIONS.md`. This file is the go/no-go gate around them.

## Before submitting

- [ ] Business Verification complete (`BUSINESS_VERIFICATION.md`).
- [ ] `META_EMBEDDED_SIGNUP_CONFIG_ID` configured and the Embedded Signup
      flow tested end-to-end against a Development-mode test app
      (`EMBEDDED_SIGNUP.md`).
- [ ] Meta App Dashboard values match the deployment — App Domains, Site
      URL, the OAuth redirect URI, **Allowed Domains for the JavaScript
      SDK** (missing this blocks Embedded Signup outright), and the webhook
      callback URL. The exact values, and the host mismatch found in the
      2026-08-25 audit, are in `AUDIT_RESPONSE_2026-08-25.md`.
- [ ] Webhook registered and verified (`WEBHOOK_SETUP.md`), signature
      enforcement on (`WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE=true`).
- [ ] Privacy Policy and Terms of Service live at public URLs (see
      `docs/legal/` — these are templates requiring legal review before
      publishing, not final documents to submit as-is).
- [ ] A dedicated reviewer account that you have signed in with yourself,
      in a private browser window, and driven all the way to the "Connect
      with Meta" button. Nothing in this repository seeds one — see
      "Creating the reviewer account" in `APP_REVIEW_SUBMISSION_TEXT.md`.
- [ ] A working demo environment showing the full connect → send → receive
      loop, with a real inbound message and a real outbound reply.
- [ ] Coexistence either proven by one real end-to-end onboarding, or
      turned off with `META_ENABLE_COEXISTENCE=false` so reviewers cannot
      enter an unproven path (`COEXISTENCE.md`).
- [ ] Request only `whatsapp_business_messaging`,
      `whatsapp_business_management` and `business_management`. Do **not**
      re-request `public_profile` — the app makes zero calls that need it,
      and the overclaim is a rejection trigger.

## What reviewers actually check

1. **Screen recording per permission** — see `REQUIRED_PERMISSIONS.md` for
   the exact mapping and `docs/videos/` for ready scripts. Reviewers watch
   these to confirm the requested permission is genuinely used for what
   you claim, not requested speculatively.
2. **Data use disclosure** — be precise about what customer WhatsApp data
   this app stores (messages, contacts, media — see `Message`/`Contact`
   models) and for how long (no retention policy is enforced in code
   today; see `docs/legal/DATA_RETENTION_POLICY.md` for the template to
   fill in and then actually implement a matching TTL/cleanup job before
   claiming a retention period to Meta or to customers).
3. **Platform Terms compliance — resolved, not merely gated.** The
   unofficial WhatsApp Web (Baileys) transport that earlier revisions of
   this document described as "disabled by default" has since been
   **removed from the codebase entirely** — the service, routes, models,
   UI, npm dependency and the per-organization feature flag are all gone
   (`docs/BAILEYS_REMOVAL.md`). The only messaging path left is the
   official Cloud API, so there is no reviewer-visible surface to gate and
   no business decision left to defer. Two follow-ups remain, neither of
   which is a review surface:
   - Drop the two now-unusable Mongo collections
     (`baileysauthstates`, `baileysmessages`) manually. `baileysauthstates`
     holds live pairing credentials for a client that no longer exists and
     is the one worth prioritising.
   - The Render service slug is still `bulk-invite.onrender.com`, a legacy
     name from that era. It is this project's own Cloud-API backend;
     renaming it changes the URL in every hardcoded reference and in the
     Meta dashboard, so do it deliberately rather than mid-review
     (`AUDIT_RESPONSE_2026-08-25.md`).

   The only remaining mentions of the old transport in the source are two
   explanatory comments (`backend/src/routes/externalApi.js`,
   `backend/src/routes/WhatsAppCloud.js`) recording why an endpoint's
   contract changed — `POST /campaigns/:id/send` now returns `501` pointing
   at the template-based `POST /api/whatsapp/broadcast`.

## After approval

- Messaging tier limits raise automatically as quality ratings and
  verification hold up over time — this is Meta policy, not app
  configuration.
- Re-review is required if you request additional permissions later
  (e.g. if phone-number-provisioning support is added — see
  `EMBEDDED_SIGNUP.md`).
