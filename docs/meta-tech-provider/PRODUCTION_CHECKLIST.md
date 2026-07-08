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
- [ ] `npm audit` reviewed on both `backend/` and `frontend/` — decide
      and document a position on any unresolved findings rather than
      leaving them silent (`xlsx` has no upstream fix as of this writing;
      confirm current status)
- [ ] Cashfree UPI Autopay integration verified against live docs before
      accepting real payments (`backend/src/services/paymentGatewayService.js`'s
      own "verify before production" header) — this is currently
      unverified and is a real launch blocker if billing is enabled

## Compliance
- [ ] The Baileys-based "Campaigns" Terms-of-Service exposure resolved
      (see `APP_REVIEW.md`) — before any real customer traffic, not just
      before App Review submission
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
