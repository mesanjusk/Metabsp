# Production checklist

Specific to this repository — cross-referenced rather than duplicated
where a fuller doc already covers something.

## Meta-side
- [ ] Business Verification complete (`BUSINESS_VERIFICATION.md`)
- [ ] App Review approved for `whatsapp_business_management` +
      `whatsapp_business_messaging` (`APP_REVIEW.md`)
- [ ] Embedded Signup configuration (`META_EMBEDDED_SIGNUP_CONFIG_ID`)
      created and tested (`EMBEDDED_SIGNUP.md`)
- [ ] Webhook registered, verify token set, signature enforcement on
      (`WEBHOOK_SETUP.md`)
- [ ] If offering Coexistence: the `history`, `smb_message_echoes` and
      `smb_app_state_sync` webhook fields subscribed in the App Dashboard,
      and one real coexistence onboarding run end to end. Until both are
      done, set `META_ENABLE_COEXISTENCE=false` so the Embedded Signup
      popup does not offer a path whose traffic goes nowhere
      (`COEXISTENCE.md`)
- [ ] At least the primary production number using a System User token
      (`SYSTEM_USER_CREATION.md`)

## App configuration
- [ ] Every var in `backend/.env.example` set to a real value (not a
      placeholder) — `JWT_SECRET`, `WHATSAPP_TOKEN_ENCRYPTION_KEY`,
      `META_APP_SECRET`, `MONGO_URI`, `REDIS_URL`, `FRONTEND_URL`, Cashfree
      vars if billing is enabled
- [ ] `TRUST_PROXY` set correctly for your actual reverse-proxy topology
      (`docs/deployment/NGINX_SSL_CLOUDFLARE.md`)
- [ ] `SENTRY_DSN` set — error tracking is otherwise silently off
      (`docs/deployment/MONITORING.md`)
- [ ] Scheduled backups configured, one way or the other
      (`docs/BACKUP_RESTORE.md`)

## Security
- [x] `npm audit` reviewed on both `backend/` and `frontend/` — `dompurify`
      and `ws` fixed via `npm audit fix`; `jspdf` bumped to 4.2.1 (resolves
      10 critical/high CVEs in the real in-app PDF export feature, build
      verified after the bump). Remaining: `xlsx` has no upstream fix as of
      this writing (used for spreadsheet import, not Baileys-specific —
      confirm current status before launch); a handful of dev/test-only
      findings (`esbuild`/`vitest`, `tar`/`canvas`/`jsdom`, `uuid`/`hyperid`/
      `autocannon`) are accepted as non-runtime risk.
- [ ] Cashfree UPI Autopay integration verified against live docs before
      accepting real payments (`backend/src/services/paymentGatewayService.js`'s
      own "verify before production" header) — this is currently
      unverified and is a real launch blocker if billing is enabled

## Compliance
- [x] The unofficial WhatsApp Web (Baileys) transport has been **removed
      entirely**, not merely gated: the service, routes, models, UI, npm
      dependency and per-org feature flag are gone, and the only messaging
      path left is the official Cloud API. This closes the Platform Terms
      exposure rather than deferring it. Two now-unusable collections
      (`baileysauthstates`, `baileysmessages`) are left for a deliberate
      manual drop — see `docs/BAILEYS_REMOVAL.md`.
- [ ] Privacy Policy / Terms of Service / DPA reviewed by an actual lawyer
      and published (`docs/legal/` — templates only as shipped)
- [ ] A real data retention policy implemented in code, not just
      documented (`docs/legal/DATA_RETENTION_POLICY.md`)

## Operational
- [ ] Load test run against your actual target infrastructure
      (`backend/loadtest/README.md`) — no numbers from this repo's own
      testing should be quoted as your production capacity
- [ ] A disaster-recovery drill actually run once
      (`docs/deployment/DISASTER_RECOVERY.md`,
      `backend/scripts/verify-restore.js`)
- [ ] Support staff have read `SUPPORT_GUIDE.md` and know the
      troubleshooting flows in `TROUBLESHOOTING.md`
