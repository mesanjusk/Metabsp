# Meta App Review

App Review is Meta's process for approving your app to request
`whatsapp_business_management`/`whatsapp_business_messaging` for real
customer accounts beyond your own test numbers — entirely a Meta-side
review, not something this codebase automates.

## Before submitting

- [ ] Business Verification complete (`BUSINESS_VERIFICATION.md`).
- [ ] `META_EMBEDDED_SIGNUP_CONFIG_ID` configured and the Embedded Signup
      flow tested end-to-end against a Development-mode test app
      (`EMBEDDED_SIGNUP.md`).
- [ ] Webhook registered and verified (`WEBHOOK_SETUP.md`), signature
      enforcement on (`WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE=true`).
- [ ] Privacy Policy and Terms of Service live at public URLs (see
      `docs/legal/` — these are templates requiring legal review before
      publishing, not final documents to submit as-is).
- [ ] A working demo environment reviewers can be given test credentials
      for, showing the full connect → send → receive loop.

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
3. **Platform Terms compliance** — this is the one genuine blocker in this
   codebase to flag honestly: the "Campaigns" feature reachable from the
   WhatsApp Cloud dashboard (`/api/whatsapp/campaigns` routes) sends via
   `bulk/services/baileysService` — an unofficial, reverse-engineered
   WhatsApp-Web client, not the official Cloud API. Using this for
   customers of the Tech Provider product risks their numbers being
   banned by Meta and is very likely to fail (or later get flagged after
   passing) App Review's Platform Terms review. **Resolve this — either
   remove/relabel that route out of the Cloud-API-branded product, or
   keep it strictly on the separate Bulk product with no BSP/Tech
   Provider claims attached — before submitting.**

## After approval

- Messaging tier limits raise automatically as quality ratings and
  verification hold up over time — this is Meta policy, not app
  configuration.
- Re-review is required if you request additional permissions later
  (e.g. if phone-number-provisioning support is added — see
  `EMBEDDED_SIGNUP.md`).
