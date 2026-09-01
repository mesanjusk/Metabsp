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
- [ ] Every var in `nextjs/.env.example` set to a real value (not a
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
- [x] `npm audit` reviewed. `xlsx`, which had unfixed advisories and no
      registry fix, has been removed entirely: CSV is parsed by
      `nextjs/lib/client/importParsers.js` and .xlsx by `read-excel-file`,
      which is clean. Remaining findings are `postcss` and `sharp`, both
      pinned transitively by `next` and only fixable by a major-version bump:
      `postcss` runs at build time on this repository's own CSS, and `sharp`
      is reachable only through the image optimiser, which is switched off in
      `next.config.js` because nothing uses `next/image`.
- [ ] Upgrade Next.js to a release that ships patched `postcss`/`sharp`. This
      pulls React 19 and therefore MUI 7 with it, so it wants its own change
      and its own regression pass — not a cutover.
- [ ] Cashfree UPI Autopay integration verified against live docs before
      accepting real payments (`nextjs/lib/services/paymentGatewayService.ts`'s
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
- [x] Data retention is implemented in code
      (`nextjs/lib/services/dataRetentionService.ts`): a daily, leader-locked
      sweep that prunes messages, inactive contacts and audit entries past a
      configured window, deletes the associated Cloudinary media before the
      row, and records each run in the audit log.
- [ ] **Choose the actual windows.** They default to 0 — keep forever — so
      the policy is enforced only once `RETENTION_MESSAGES_DAYS`,
      `RETENTION_CONTACTS_INACTIVE_DAYS` and `RETENTION_AUDIT_LOG_DAYS` are
      set. Deleting message history is irreversible; this is a decision for
      the operator and their counsel, not a default.

## Operational
- [ ] Load test run against your actual target infrastructure
      (`nextjs/loadtest/README.md`) — no numbers from this repo's own
      testing should be quoted as your production capacity
- [ ] A disaster-recovery drill actually run once
      (`docs/deployment/DISASTER_RECOVERY.md`,
      `nextjs/scripts/verify-restore.mjs`)
- [ ] Support staff have read `SUPPORT_GUIDE.md` and know the
      troubleshooting flows in `TROUBLESHOOTING.md`
