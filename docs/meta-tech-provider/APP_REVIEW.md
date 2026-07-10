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
3. **Platform Terms compliance — now mitigated, not eliminated.** The
   Baileys/WhatsApp-Web features (manual connect, campaigns, and the
   `/api/v1/baileys/*` External API) send via `bulk/services/baileysService`
   — an unofficial, reverse-engineered WhatsApp-Web client, not the official
   Cloud API. As of this round, these are **disabled by default for every
   organization** — hidden from the dashboard nav, blocked at every backend
   route (`requireBaileysEnabled` middleware, `Organization.baileysEnabled`,
   default `false`) — and can only be turned on per customer by a super
   admin via `PATCH /api/bulk/org/:id/baileys` or the toggle in
   `SuperAdminSettingsPage`. For an App Review submission and demo
   environment where this flag is left off, reviewers testing the Cloud-API
   BSP product will never reach or see these features at all, which
   substantially de-risks the review. **Still resolve explicitly before
   submitting:** confirm the flag is off for whatever org/demo account you
   hand reviewers, and make your own business decision about whether to
   ever enable it for a Tech-Provider-branded customer — the underlying
   Platform Terms risk (an unofficial client sending on a customer's behalf)
   is unchanged for any organization you do choose to enable it for.

## After approval

- Messaging tier limits raise automatically as quality ratings and
  verification hold up over time — this is Meta policy, not app
  configuration.
- Re-review is required if you request additional permissions later
  (e.g. if phone-number-provisioning support is added — see
  `EMBEDDED_SIGNUP.md`).
