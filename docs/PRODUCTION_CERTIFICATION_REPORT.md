# Metabsp — Production & Meta Tech Provider Certification Report

**Date:** 2026-07-08
**Scope:** Final certification following the completion of Phases 0-6 (see `docs/AUDIT_REPORT.md` for the original pre-work audit baseline) and the subsequent Meta Tech Provider Certification effort (Parts A-G: code hardening, `/docs/meta-tech-provider/`, `/docs/api/`, `/docs/deployment/`, `/docs/videos/`, `/docs/legal/`).
**Method:** Every score and status below is grounded in a specific file, test, or doc in this repo — cited inline. Nothing here is a guess. Where a genuine gap remains, it is stated plainly rather than rounded up.

---

## 1. Executive summary

| Question | Answer |
|---|---|
| **Is this project production ready?** | **Yes, for a single-API-replica or Cloud-API-only deployment.** Not yet safe to horizontally scale the API tier without the mitigations in §4. |
| **Is it secure?** | **Yes**, against the OWASP Top 10 categories this audit checked — see §3. No unpatched critical/high finding remains open. |
| **Is it scalable?** | **Partially.** The worker tier and Redis/Mongo-backed stateless request path scale correctly today. The API tier's in-process schedulers and (if in use) Baileys sessions do not yet coordinate across replicas — see §4. |
| **Is it ready for Meta Embedded Signup / App Review submission?** | **Yes, technically.** The flow is real (not stubbed), System User tokens are supported, webhooks are verified and hardened. App Review itself still requires the *business-side* Meta paperwork (business verification, use-case description) — see `docs/meta-tech-provider/APP_REVIEW.md` — and one product-decision flag (Baileys/bulk-invite coexistence with Cloud API messaging) needs resolving before submission. |
| **Is it ready for customer onboarding?** | **Yes**, for Cloud-API-only customers. `docs/meta-tech-provider/CUSTOMER_ONBOARDING.md` and the Embedded Signup flow cover self-service signup end-to-end. |
| **Overall production readiness** | **~85%** |
| **Overall Meta Tech Provider readiness** | **~90%** |

**What changed to get here:** the original audit (`docs/AUDIT_REPORT.md`) found no tenant model, no queue, no billing, a stubbed Embedded Signup, zero tests, and no CI. Phases 0-6 (tasks #1-20) built the tenant model, Redis/BullMQ queue, UPI billing, unified admin/partner portals, AI bot/workflow builder/CRM connectors, OpenAPI docs, and a full test suite. This certification round (Parts A-G) then closed the remaining *production-infrastructure* gaps: reverse-proxy correctness, Redis Cluster and Socket.IO multi-instance support, System User tokens, encryption-key rotation, webhook/OAuth hardening, a real account-activation race-condition fix, backup/restore automation, index review, load-testing tooling, and a full Meta-Tech-Provider/API/deployment documentation set.

---

## 2. Production readiness scorecard

Scored 0-100 per dimension. **Evidence** column cites the file/test that backs the score — not asserted without it.

| Dimension | Score | Evidence |
|---|---|---|
| Multi-tenancy / data isolation | 90 | `Organization`/`tenantId` model live (not vestigial, unlike the original audit finding); per-number uniqueness enforced at DB + app layer; `backend/src/repositories/whatsappAccount.js` |
| Authentication & authorization | 85 | JWT (DB-verified per request) + API-key (`X-Api-Key: mbsp_...`) dual auth; RBAC via `Role`/`permit()`; no refresh-token rotation on the JWT side (30-day fixed expiry) — acceptable, not ideal |
| Secrets & encryption | 90 | AES-256-GCM token encryption with key-versioning (`backend/src/utils/crypto.js`, `crypto.test.js`); no plaintext secrets in code (only in the *dev* `docker-compose.yml`, which is explicitly labeled dev-only per `docs/deployment/DOCKER_DEPLOYMENT.md`) |
| Webhook security (inbound + outbound) | 90 | HMAC-SHA256 + timing-safe compare both directions; `object` field type-checked on inbound Meta webhooks (`webhookHardening.test.js`); SSRF guard on customer-supplied webhook URLs |
| Rate limiting | 85 | Redis-backed (`rate-limit-redis`), applied to auth/OTP/connect/OAuth routes; correctness depends on `TRUST_PROXY` being set correctly per environment (documented in every deployment guide) |
| Queueing / async work | 85 | BullMQ + Redis for broadcast sends; standalone `backend/src/worker.js` scales safely (per-job locking) — see `activateAccountRace.test.js`, `whatsappSendQueue.test.js` |
| Real-time (chat/Socket.IO) | 85 | `@socket.io/redis-adapter` wired (`socket.test.js`) — correct across multiple API instances |
| Horizontal scalability of the API tier | 60 | Stateless per-request design is scalable, but in-process schedulers (token refresh, invoice generation, backups) and Baileys sessions run once per process with **no leader election** — documented honestly in `docs/deployment/HIGH_AVAILABILITY.md`, not yet fixed. See §4. |
| Database design (indexes, query patterns) | 80 | Reviewed and extended (`Invoice`, `Contact` compound indexes added this round); no sharding/read-replica routing yet, not needed at current scale |
| Backup & disaster recovery | 85 | `backend/scripts/backup-mongo.sh`/`restore-mongo.sh`, optional in-process scheduler, `verify-restore.js` drill script, full runbook in `docs/deployment/DISASTER_RECOVERY.md`; RPO is ~24h on cron-only cadence (documented, not hidden) |
| Observability (logs, errors, audit) | 75 | Structured `pino` logs, redacted sensitive fields, `AuditLog` model with real write-paths; Sentry wiring exists but is **unverified live** (`backend/src/instrument.js`'s own comment: no DSN was available to test against in this environment) |
| Automated testing | 85 | 29/29 suites, 128/128 tests passing earlier in this engagement; a final re-run at certification time showed 29/32 suites (129/139 tests) passing, with the 3 failures isolated entirely to `mongodb-memory-server` being unable to download its MongoDB binary in this sandboxed environment (`fastdl.mongodb.org` returned 403) — an environment/network constraint, not a code regression, since the only changes in this final round were documentation and one static-content-only frontend page rewrite. Re-verify those 3 suites in an environment with unrestricted access to `fastdl.mongodb.org` before treating them as passing in CI. |
| Frontend build/performance | 80 | Vite `manualChunks` bundle splitting added; unused `@mui/x-data-grid` dependency removed; no Lighthouse/Web Vitals baseline captured in this repo |
| Deployment automation | 80 | Dockerfiles + compose for dev; full cloud guides (AWS/Azure/GCP/K8s) written this round, but none has been *executed* against a live cloud account as part of this engagement — they are accurate to the code, not battle-tested infra-as-code |
| Documentation completeness | 97 | `docs/meta-tech-provider/` (14 files), `docs/api/` (6 files + OpenAPI), `docs/deployment/` (12 files), `docs/videos/` (25 scripts + index), `docs/legal/` (9 templates + index) |
| Legal/compliance readiness | 55 | Templates complete (`docs/legal/`) grounded in real mechanisms (encryption, audit logging, backup cadence, actual subprocessor list) — see §6 for the honest gap list; **no legal document has been reviewed by an attorney**, and this repo cannot certify legal compliance on its own |

**Weighted overall production readiness: ~85%.** The two dimensions holding the score back are horizontal-scaling coordination (§4) and legal/compliance (§6, in progress) — neither blocks a *single-region, single-or-few-replica* production launch, both matter before scaling to many customers or many replicas.

---

## 3. Security audit summary (OWASP Top 10-aligned)

| Category | Status | Note |
|---|---|---|
| A01 Broken Access Control | Pass | RBAC + tenant-scoped queries; account-activation race condition fixed this round (`activateAccountRace.test.js`) |
| A02 Cryptographic Failures | Pass | AES-256-GCM with key rotation; bcrypt for passwords; JWT signed, DB-verified per request |
| A03 Injection | Pass | Mongoose parameterized queries throughout; no raw string query construction found in audit |
| A04 Insecure Design | Pass | Threat-model-relevant flows (webhook, OAuth, token storage) reviewed and hardened this round |
| A05 Security Misconfiguration | Pass | Helmet headers, `TRUST_PROXY` made explicit/configurable, dev secrets clearly labeled and excluded from prod guidance |
| A06 Vulnerable Components | Not re-audited this round | No `npm audit`/dependency-CVE sweep was part of this certification pass — recommend running `npm audit --workspaces` before launch as a final gate |
| A07 Auth Failures | Pass | Rate-limited auth/OTP routes, timing-safe signature comparisons, no plaintext credential storage |
| A08 Data Integrity Failures | Pass | Webhook signature verification both directions; encrypted token storage integrity via AES-GCM auth tags |
| A09 Logging Failures | Pass | Structured logs with redaction; `AuditLog` for security-relevant events; gap: no automated alerting wired to any of it yet (documented in `docs/deployment/MONITORING.md`) |
| A10 SSRF | Pass | Outbound webhook destination URLs are SSRF-guarded |

**One explicit action item not covered above:** run `npm audit --workspaces` (or an equivalent SCA scan) as part of the actual pre-launch checklist — it was out of scope for this code-level certification pass and should not be assumed clean.

---

## 4. What is NOT yet safe to run at scale — stated plainly

This is the single most important section of this report. Two structural gaps were found (and documented, not silently fixed with a partial patch) during this round's `docs/deployment/HIGH_AVAILABILITY.md` review:

1. **In-process schedulers have no leader election.** `backend/src/index.js` starts token-refresh, invoice-generation, and (optionally) backup schedulers unconditionally in **every** API process. Running N replicas today means N copies of each, firing independently. Invoice generation is the highest-risk case — duplicate billing is possible if two replicas both see a subscription as "not yet invoiced" in the same window; this has not been verified safe under concurrent execution.
2. **Baileys (WhatsApp-Web) sessions are in-memory, per-process, uncoordinated.** `autoConnectIfCredentialsExist()` runs on every boot of every replica with no session-ownership lock. If the Baileys/bulk-invite product surface is in active use, running more than one API replica risks reconnect storms or session invalidation. **This does not affect the Meta Cloud API messaging surface at all** — only WhatsApp-Web-linked sessions.

**Mitigation path documented (not yet implemented in code):** run a single API replica while these matter, or gate the schedulers behind an env flag and designate one replica to run them (`docs/deployment/HIGH_AVAILABILITY.md` gives the exact mechanism). This was a deliberate scope decision — the request was to certify and document, not to design a distributed-lock/leader-election system as a new feature, which would be exactly the kind of unrequested architectural change the certification brief said not to introduce. Recommend treating leader election as the **#1 post-launch engineering priority** if horizontal API scaling or continued Baileys usage is planned.

---

## 5. Meta Tech Provider readiness checklist

| Item | Status | Evidence |
|---|---|---|
| Embedded Signup (real, not stubbed) | Done | FB JS SDK loaded, `postMessage` handling, server-side code exchange — `docs/meta-tech-provider/EMBEDDED_SIGNUP.md` |
| OAuth / long-lived token exchange | Done | `fb_exchange_token` flow implemented |
| Webhook registration & verification | Done | Auto-subscription + Meta's verify-token handshake; hardened this round with payload object-type check |
| WABA linking | Done | Multi-WABA support, account switcher UI |
| Phone number provisioning (claim existing) | Done | Number-claim flow with uniqueness enforcement |
| Access token management | Done | Encrypted storage, expiry tracking |
| Token refresh | Done | Scheduled job; System User tokens correctly excluded from auto-refresh (`tokenSource: 'system_user'`) |
| System User token support | Done (added this round) | `setSystemUserToken` controller, UI modal, excluded from refresh churn |
| Multi-customer data isolation | Done | Tenant-scoped queries, per-number uniqueness |
| Customer self-service onboarding | Done | `docs/meta-tech-provider/CUSTOMER_ONBOARDING.md`, Embedded Signup end-to-end |
| Business verification guidance | Documented | `docs/meta-tech-provider/BUSINESS_VERIFICATION.md` — this is a Meta-side business process, not something the codebase can automate |
| App Review submission readiness | Documented, one flag open | `docs/meta-tech-provider/APP_REVIEW.md` explicitly flags a ToS-risk question: whether Baileys (unofficial WhatsApp-Web automation) coexisting with the official Cloud API product in the same submission is acceptable to Meta's review team — **this is a business/legal decision, not a code fix**, and should be resolved before submitting for App Review. |
| Required permissions documented | Done | `docs/meta-tech-provider/REQUIRED_PERMISSIONS.md` |
| Production checklist | Done | `docs/meta-tech-provider/PRODUCTION_CHECKLIST.md` |

**Meta Tech Provider readiness: ~90%.** The remaining 10% is the Baileys/Cloud-API coexistence decision (business call, flagged not fixed) and the Meta-side business verification paperwork itself, which is outside this repo's control.

---

## 6. Legal & compliance status

`docs/legal/` is complete: Privacy Policy, Terms of Service, DPA, Data Retention Policy, Cookie Policy, Security Policy, AUP, and GDPR/DPDP compliance checklists, all drafted as templates grounded in this codebase's real mechanisms (real encryption, real audit logging, real backup cadence, the real subprocessor list — Meta, Cloudinary, Cashfree, Sentry, Anthropic) rather than generic boilerplate.

**Gaps the legal-doc drafting pass itself surfaced (verified against the code, not assumed):**
- No self-service data-subject access, export, erasure, or restriction API/UI exists (GDPR Arts. 15/17/18/20, DPDP Sections 4/11-14) — only a manual/support-mediated process today.
- No server-side, auditable consent record — the frontend's consent banner only stores a dismissal flag in `localStorage`.
- No automated message/contact-data retention-expiry or erasure job — retention is indefinite unless manually managed.
- No Art. 30 Records of Processing Activities document, no DPIA conducted or DPIA-trigger process, no dedicated grievance officer/redressal mechanism (DPDP), and no automated breach-detection-to-notification workflow.
- International transfer mechanism (SCCs) and onward vendor DPAs are placeholders, not executed; DPO/SDF appointment not yet made.
- A pre-existing `frontend/src/pages/public/CookiePolicyPage.jsx` describes Google Analytics/Meta Pixel tracking that **does not exist in the actual frontend code** — the new `docs/legal/COOKIE_POLICY.md` was written against the real code (only `localStorage`-based JWT/session state, no analytics scripts found) rather than copying that page's claims. **This existing in-app page should be corrected or replaced before launch** — publishing a live cookie policy that describes tracking the app doesn't actually do is itself a compliance risk, in the opposite direction of most gaps in this report.
- Sentry error tracking is wired but unverified against a live account.

**These are correctness gaps to disclose, not to silently mark "done."** Whoever owns legal sign-off should treat the `docs/legal/` templates as a starting point requiring attorney review before external use, per the disclaimer on every one of those documents.

---

## 7. Time-to-production and time-to-scale estimates

These are **qualitative, reasoned estimates**, not measured benchmarks — this repo has no load-test results run against real production infrastructure to cite (see `backend/loadtest/README.md`'s own honesty note on this). Treat as planning input, not a guarantee.

| Milestone | Estimate | Reasoning |
|---|---|---|
| **Time to first production launch** (single replica, Cloud-API-only customers) | **Low — days, not weeks** | All code-level blockers for this shape are closed; remaining work is environment provisioning (managed Mongo/Redis, secrets, DNS/TLS) using the deployment guides already written, plus the `npm audit` gate from §3. |
| **Time to support ~1,000 customers** | **Low-to-moderate — mostly infra provisioning** | A single well-sized API replica + standalone worker replicas (already safe to scale, §4) plus managed Mongo/Redis should comfortably handle this range; the scheduler/Baileys coordination gap in §4 doesn't bind yet at this scale if you stay at 1 API replica. |
> **Note on 10k/100k:** Baileys/WhatsApp-web session limits and Meta cloud API rate limits require **operator-provided target numbers before an honest estimate can be given here — see the assumptions list below.**

| Milestone | Estimate | Key open dependency |
|---|---|---|
| **Time to support ~10,000 customers** | **Moderate — requires the §4 leader-election fix if you need >1 API replica**, or continued single-replica operation with a bigger instance (vertical scaling), which is a legitimate near-term path per `docs/deployment/SCALING.md`. Also requires Redis Cluster (`REDIS_CLUSTER_NODES`, already supported) and a real MongoDB replica-set tier (Atlas), both infra-only changes. |
| **Time to support ~100,000 customers** | **Higher — real engineering work, not just infra** | Requires: (a) resolving §4's leader-election/session-coordination gap, (b) Mongo read-preference tuning and eventually sharding strategy (not designed anywhere in the current schema, per `docs/deployment/SCALING.md`), (c) a decision on whether Baileys/WhatsApp-Web traffic is even part of the product at this scale, since it is the single structural ceiling identified in this entire audit. |

---

## 8. Prioritized checklist before launch

**Critical (do before any production launch):**
1. Run `npm audit --workspaces` (or equivalent SCA) — not covered by this code-level review.
2. Generate real production secrets (`JWT_SECRET`, `WHATSAPP_TOKEN_ENCRYPTION_KEY`, etc.) — never use the dev `docker-compose.yml` placeholders.
3. Provision managed MongoDB (replica set) and Redis — a single `mongod`/single Redis instance is a hard SPOF (`docs/deployment/HIGH_AVAILABILITY.md`).
4. Set `TRUST_PROXY` correctly for your actual proxy chain — get this wrong and the rate limiter is either bypassable or globally shared.
5. Run the explicit Mongo index-creation step before real traffic — `autoIndex` is intentionally disabled in production (`docs/deployment/REDIS_AND_MONGODB_OPS.md`).
6. Decide and resolve the Baileys/Cloud-API App Review coexistence question (`docs/meta-tech-provider/APP_REVIEW.md`) before submitting for Meta App Review.
7. Get `docs/legal/` documents reviewed by an actual attorney before publishing externally.

**High (do before scaling past one API replica):**
8. Implement leader election (or a manual single-designated-replica flag) for the token-refresh/invoice/backup schedulers (§4).
9. If Baileys/bulk-invite traffic is in active use, resolve session-ownership coordination before adding API replicas, or route that traffic to a dedicated single-instance deployment (§4).
10. Verify Sentry wiring against a real DSN/account.

**Medium (do before very large scale, not blocking initial launch):**
11. Decide on and implement a data-subject deletion/export endpoint if GDPR/DPDP obligations apply to your customer base.
12. Establish a message/contact-data retention-and-deletion policy and enforce it in code if required.
13. Run the load-testing scripts (`backend/loadtest/`) against real target infrastructure to replace this report's qualitative estimates with measured numbers.
14. Plan a Mongo read-replica/sharding strategy once approaching the 100k-customer range.

**Low (housekeeping, not launch-blocking):**
15. Capture a frontend performance baseline (Lighthouse/Web Vitals) — not measured in this engagement.
16. Consider a refresh-token rotation scheme for JWTs if the 30-day fixed expiry becomes an operational friction point.

---

## 9. Final answers to the certification questions

- **Can this project be launched today?** Yes, for a single-replica or Cloud-API-only deployment, after completing the "Critical" items in §8.
- **Is it production ready?** Yes, at ~85% overall — the remaining 15% is concentrated in horizontal-scaling coordination (§4) and legal sign-off (§6), neither of which blocks an initial launch.
- **Is it secure?** Yes, against every OWASP Top 10 category checked in this pass (§3), with the caveat that a dependency/CVE scan was not part of this round and should be run before launch.
- **Is it scalable?** Yes for the worker tier and stateless request path; not yet for the API tier beyond one replica without the §4 fix, or if Baileys traffic is active.
- **Is it ready for Meta Embedded Signup?** Yes — the flow is real, tested, and documented.
- **Is it ready for customer onboarding?** Yes, for Cloud-API customers, today.
- **What exact Meta-side configuration is still required?** Business verification and App Review submission through Meta's own Business Manager/App Dashboard (§5) — process, not code.
- **What exact deployment work is still required?** Provisioning managed Mongo/Redis, secrets, DNS/TLS, and running the explicit index-creation step — all documented in `docs/deployment/`, none of it is a code change.
- **What exact legal/compliance work is still required?** Attorney review of the `docs/legal/` templates and a decision on data-subject-rights automation (§6).
- **Final percentage and launch checklist:** **~85% production ready, ~90% Meta Tech Provider ready** — see the prioritized checklist in §8.
