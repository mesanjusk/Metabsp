# Metabsp Enterprise Audit — Meta WhatsApp Tech Provider (BSP) Readiness

**Date:** 2026-07-08
**Scope:** Full repository audit (`backend/src`, `backend/bulk`, `frontend`, infra/CI/CD) performed prior to any code changes, per the "audit first" mandate. No functional code has been modified as part of this report.

---

## 1. What this repository actually is today

Metabsp is **two products merged into one deployable app**, not a single clean codebase:

| | "Cloud" product (`backend/src`, `frontend/src/Pages`+`Components`) | "Bulk" product (`backend/bulk`, `frontend/src/pages`+`components`) |
|---|---|---|
| WhatsApp transport | Official Meta Cloud API (Graph API) | Unofficial Baileys (WhatsApp-Web protocol) |
| Identity model | `WhatsAppAccount` per user, encrypted tokens | `Organization`/`Role`/`User`, generic CRUD |
| Auth | Same JWT, same `User` model (bulk owns it) | Same JWT, same `User` model |
| State | Newer, better-isolated, encrypted at rest | Older, generic-CRUD-driven |

Both are mounted in the same Express app (`backend/src/index.js`) and the same React router (`frontend/src/App.jsx`), with **two parallel auth contexts, two axios clients, two Mongo connections, and two Cloudinary clients** running simultaneously. `bulk` already imports from `src/utils` (password verification), so the two trees are not cleanly separable — any refactor must treat them as one system.

**This is preserved, not rewritten**, per instructions. The recommendation throughout this report is *consolidate and extend*, not replace.

### Strengths worth explicitly preserving
- AES-256-GCM encryption of WhatsApp access tokens at rest (`src/utils/crypto.js`), key from `WHATSAPP_TOKEN_ENCRYPTION_KEY`.
- Real webhook signature verification (HMAC-SHA256 + `crypto.timingSafeEqual`) gated by `WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE`.
- Per-phone-number uniqueness enforced both at the DB layer (partial unique index) and the app layer (`assertPhoneNumberAvailable`) — genuine multi-tenant-safe isolation on the one axis that matters most (nobody can hijack another customer's number).
- Self-service webhook destinations with retries, per-destination HMAC secrets, and an SSRF guard on user-supplied URLs.
- RBAC scaffolding (`Role` + permission strings + `permit()` middleware), OTP-based auth already live.
- A genuinely fairly complete WhatsApp dashboard UI: shared inbox, templates, campaigns, CRM panel, analytics, auto-reply, PWA.

### Systemic gaps (why this isn't yet a BSP platform)
- **No tenant/billing entity.** Isolation is per-*user*-owns-one-*number*, not per-*organization*-owns-many-*WABAs*/numbers/seats. `Organization`/`tenantId` exist but are vestigial (`routes/Users.js` always queries `tenantId: null`).
- **No queue.** Every "background" operation (broadcasts, campaigns, webhook processing) is `setImmediate`/`setTimeout`/an in-process loop with `await sleep()`. Nothing survives a restart; nothing scales past one instance.
- **No billing anywhere** — confirmed via full-repo grep, zero hits beyond an unrelated WhatsApp template literally named `amount_payment_sk`.
- **Embedded Signup is stubbed**, not real: the Facebook JS SDK is never loaded in `index.html`, so `window.FB` is `undefined` at runtime and the flow silently falls back to `window.prompt('Paste signup token...')`.
- **Zero automated tests** (backend and frontend), **no Dockerfile**, **no CI gate** (the one workflow, `deploy-watch.yml`, only detects deploy failures after the fact — it doesn't run lint/test/build on PRs).
- `pino` is a listed dependency and never imported anywhere — logging is unstructured `console.log`.

---

## 2. Missing Feature Report

Scored against every capability requested for a production Tech Provider platform. **Present** = fully implemented, **Partial** = scaffolded/incomplete/inconsistent, **Missing** = not found anywhere in the repo (verified by grep + agent-assisted file reads across both `backend/src` and `backend/bulk`).

| # | Feature | Status | Evidence |
|---|---|---|---|
| 1 | Meta Embedded Signup | Partial | Backend token-exchange endpoint exists; frontend FB SDK never loaded (`WhatsAppCloudDashboard.jsx`), falls back to manual paste |
| 2 | Multi-tenant SaaS architecture | Missing | `Organization`/`tenantId` vestigial; isolation is per-user only |
| 3 | Automatic customer onboarding | Missing | No self-serve signup → WABA → number → live flow |
| 4 | WABA provisioning | Missing | Can connect an *existing* WABA/number, cannot provision a new one via Graph API |
| 5 | Phone Number provisioning | Partial | Claim-existing-number flow only, no number registration/porting |
| 6 | Access Token lifecycle | Partial | Encrypted storage exists; no expiry tracking |
| 7 | Token refresh | Missing | No scheduled refresh job; long-lived tokens assumed forever-valid |
| 8 | Webhook auto registration | Missing | Webhook config is static/app-level, not auto-subscribed per WABA via Graph API |
| 9 | Auto webhook verification | Partial | Meta's verify-token handshake works; no automated per-tenant subscription verification |
| 10 | Multi WABA support | Missing | One shared app-level Meta config; no WABA switcher |
| 11 | Multi phone number support | Partial | Schema allows multiple `WhatsAppAccount`s; no dashboard UI to switch between numbers |
| 12 | Subscription plans | Missing | None found |
| 13 | UPI billing automation | Missing | None found (superseding Razorpay per product decision) |
| 14 | Usage based billing | Missing | No metering of messages/conversations for billing |
| 15 | Invoice generation | Missing | None found (jsPDF is present but used for unrelated exports) |
| 16 | Customer portal | Partial | Dashboard exists; no plan/usage/billing sections |
| 17 | Admin portal | Partial | Fragmented across 3 separate surfaces (Cloud admin tab, Bulk `/admin` + `/super-admin/settings`, Tech Provider dashboard) |
| 18 | Partner portal | Missing | No reseller/partner/agency concept |
| 19 | Customer analytics | Partial | `AnalyticsDashboard.jsx` exists; no cost/usage-based views |
| 20 | Conversation analytics | Partial | Basic message dashboard; no Meta conversation-category cost modeling |
| 21 | Template management | Partial | Fetch/select existing Meta templates; no create/submit-for-review CRUD |
| 22 | Template sync | Missing | No scheduled job to sync template status changes from Meta |
| 23 | Broadcast engine | Partial | Works, but synchronous per-request loop, blocks HTTP, no Meta-rate-aware throttling |
| 24 | Campaign management | Partial | Two competing implementations (Baileys `Campaign` vs Cloud `sendBroadcast`), not unified |
| 25 | Shared Team Inbox | Partial | Inbox UI exists; no per-conversation agent assignment/ownership since numbers are single-owner |
| 26 | AI chatbot integration | Missing | No LLM/AI integration anywhere |
| 27 | Workflow builder | Missing | `reactflow`/`react-flow-renderer` installed but **unused** in any page — dead dependency |
| 28 | CRM integration | Partial | Internal `CRMPanel.jsx` only; no external CRM connectors |
| 29 | Redis queues | Missing | Confirmed via grep — no `ioredis`/`redis` anywhere |
| 30 | BullMQ workers | Missing | Confirmed via grep — no `bullmq`/`bull` anywhere |
| 31 | Rate limiting | Partial | Hand-rolled in-memory `Map` limiter, not distributed, not applied to `/login`/OTP endpoints |
| 32 | Retry queues | Partial | Webhook-destination delivery retries exist; message-send retries do not |
| 33 | Dead letter queues | Missing | None found |
| 34 | Audit logs | Missing | No `AuditLog` model; `Notification` is user-facing only |
| 35 | Encryption | Partial | Tokens encrypted at rest (AES-256-GCM); no KMS/key-rotation strategy, no encryption for other PII fields |
| 36 | Role based permissions | **Present** | `Role` model + permission strings + `permit()` middleware |
| 37 | API versioning | Partial | Only `/api/v1/*` (external API-key surface); everything else unversioned |
| 38 | OpenAPI documentation | Missing | None found |
| 39 | Unit tests | Missing | 0 test files backend or frontend; `package.json` test script is a stub |
| 40 | Integration tests | Missing | `mongodb-memory-server` installed but unused |
| 41 | Docker optimization | Missing | No Dockerfile anywhere in repo |
| 42 | Production deployment | Partial | Render + Vercel configs work; no health-gated rollout, no rollback strategy |
| 43 | CI/CD improvements | Partial | `deploy-watch.yml` only detects post-deploy failures; no lint/test/build gate on PRs |
| 44 | Performance optimization | Missing | No caching layer; `mongoose.set('debug', true)` left on unconditionally in `bulk/config/db.js` |
| 45 | Security audit | — | See §3 below |
| 46 | OWASP compliance | Partial | See §3 |
| 47 | Error handling standardization | Partial | Centralized handler exists (`errorHandler.js`) but bypassed by many hand-rolled try/catch blocks with inconsistent response shapes |
| 48 | Logging standardization | Missing | `pino` installed, never imported; all logging is unstructured `console.*` |
| 49 | Monitoring | Missing | No APM/Sentry/metrics endpoint |
| 50 | Health checks | Partial | Basic `/health` exists (`index.js:114`); no readiness/liveness split, no dependency checks beyond Mongo ping |
| 51 | Backup strategy | Missing | No documented/automated Mongo backup |
| 52 | Database optimization | Partial | Two independent Mongo connections (`src` + `bulk`) instead of one shared pool |
| 53 | Index optimization | Partial | Some good indexes (partial unique on `phoneNumberId`); no full index review done |
| 54 | Code cleanup | Needed | Dead root-level frontend files (`App.jsx`, `apiClient.js`, `theme.js`, `index.css` outside `src/`), duplicate Cloudinary clients, duplicate Mongo connections |
| 55 | Folder cleanup | Needed | `bulk` vs `src`, `Pages/Components` vs `pages/components` — see §1 |
| 56 | Remove technical debt | Ongoing | Captured throughout this table |

### Weighted completion score
Present = 1pt, Partial = 0.5pt, Missing = 0pt, across the 56 scored capabilities:

**1 present + 25 partial (12.5) = 13.5 / 56 ≈ 24%**

**Exact percentage of the requested Tech Provider scope completed today: ~24%.**
This reflects a real, working single-tenant WhatsApp messaging product with almost no SaaS/billing/multi-tenant/ops layer around it yet.

---

## 3. Security Report

| Severity | Finding | Location |
|---|---|---|
| High | No `helmet` — missing security headers (CSP, HSTS, X-Content-Type-Options, etc.) anywhere in the stack | `backend/src/index.js` |
| High | Auth endpoints (`/login`, `/signup/request-otp`, `/forgot-password/*`) have **no rate limiting** — brute-forceable | `src/routes/Users.js`, hand-rolled limiter only applied to messaging/external-API routes |
| High | Rate limiter is in-memory (`Map`), resets on restart and **does not work across multiple instances** — false sense of protection at scale | `src/middleware/rateLimit.js` |
| Medium | Generic CRUD factory (`crudRoutes.js`) spreads raw `req.body` into `Model.create`/`findOneAndUpdate` with only `tenantId` forced — mass-assignment risk (e.g. privileged fields on Role docs) if `permit()` isn't layered on top, and it currently isn't for `/api/bulk/roles` | `bulk/routes/crudRoutes.js`, wiring in `src/index.js:145,147` |
| Medium | `mongoose.set('debug', true)` unconditionally in `bulk/config/db.js` — logs full query contents (potentially PII) to stdout in production | `bulk/config/db.js:5` |
| Medium | JWT expiry is 99 days with no refresh/rotation and no server-side revocation list | `bulk` auth / `src/routes/Users.js:76` |
| Low | Bootstrap super-admin password comparison is a plain `===` (non-constant-time) — acceptable only because it's an env-gated break-glass path, not DB-backed | `bulk/controllers/authController.js` |
| Low | `express.json({ limit: '50mb' })` — large body limit for a JSON API, DoS/memory-pressure surface | `src/index.js:99` |
| Informational | Webhook signature verification and SSRF guard on self-service webhook URLs are both done correctly — no action needed | `src/routes/webhook.js`, `src/routes/webhookDestinations.js` |
| Informational | Token encryption (AES-256-GCM) is sound; no KMS/rotation plan exists for `WHATSAPP_TOKEN_ENCRYPTION_KEY` itself | `src/utils/crypto.js` |

**OWASP Top-10 posture:** A01 (Broken Access Control) — medium risk via mass-assignment gap; A05 (Security Misconfiguration) — high risk via missing helmet + debug logging; A07 (Auth Failures) — high risk via missing rate limits on auth; others (injection, crypto failures, SSRF) are in reasonably good shape already.

---

## 4. Performance Report

- **No caching layer** (no Redis) — every request that needs Meta template lists, account status, etc. hits the DB/Graph API cold each time.
- **Synchronous broadcast/campaign sends block the HTTP request thread** for the entire recipient list (`sendBroadcast`, `runCampaign`) — a 1,000-recipient campaign holds a connection (and a Node event-loop timer chain in the Baileys path) for the full duration, with no way to scale beyond one worker's throughput.
- **Two independent Mongoose connections** (`src/config/mongo.js` + `bulk/config/db.js`) rather than one shared pool — doubles connection overhead and configuration drift risk.
- No composite-index review performed; existing indexes look reasonable for the current query patterns but haven't been profiled under load.
- `compression()` and `express.json` limits are configured sensibly; no other backend perf issues found.
- Frontend: no code-splitting/lazy-loading observed across the large dashboard bundle (Cloud + Bulk apps both fully mounted at once); no React Query/SWR, so no request de-duplication or caching — every navigation re-fetches.

---

## 5. Production Readiness Score

| Category | Score /10 | Rationale |
|---|---|---|
| Core messaging functionality | 7 | Real Cloud API integration, encrypted tokens, working inbox/campaigns/templates |
| Security | 4 | Good crypto/webhook hygiene, but missing headers + auth rate limiting + mass-assignment gap |
| Multi-tenancy / SaaS | 1 | Per-user isolation only; no org/billing entity |
| Billing & monetization | 0 | Nothing implemented |
| Scalability (queues/workers) | 1 | Entirely synchronous/in-process |
| Observability (logging/monitoring) | 2 | Health check exists; no structured logs, no APM |
| Testing | 0 | Zero automated tests |
| DevOps (Docker/CI/CD) | 3 | Deploys work; no containerization, no test gate |
| Architecture / code health | 4 | Functional but duplicated (two backends, two frontends, two Mongo/Cloudinary clients) |

**Overall Production Readiness: ~2.7 / 10** as a multi-customer Tech Provider platform. As a single-tenant internal WhatsApp tool, the core is considerably stronger (~6-7/10).

---

## 6. Prioritized Implementation Roadmap

Given the scope (56 capabilities spanning infra, billing, multi-tenancy, and product features), attempting everything in one pass risks shallow, unreviewed changes to a codebase that already has real, working functionality (live OTP auth, webhooks, campaigns). The recommended path is phased, each phase independently shippable and each preserving all existing routes/behavior:

**Phase 0 — Foundation & stabilization** *(low risk, unblocks everything else)*
Consolidate duplicate Mongo connections and Cloudinary clients; delete dead root-level frontend files; wire up `pino` for structured logging; add `helmet`; extend rate limiting to auth/OTP endpoints; standardize the error-response envelope; add Dockerfiles (backend + frontend) and docker-compose for local dev; add a CI workflow that runs lint/test/build on every PR; scaffold a test framework (Jest/Vitest + `mongodb-memory-server`, already installed unused).

**Phase 1 — Multi-tenant core & real Embedded Signup**
Introduce a real `Tenant`/`Organization` as the billing+isolation boundary (migrate `User`/`WhatsAppAccount` onto it, backward-compatible); load the actual Facebook JS SDK and complete the Embedded Signup OAuth flow end-to-end (WABA creation, phone-number provisioning, System User token exchange); auto-register/verify webhooks per WABA via the Graph API; add token-expiry tracking and a refresh job; build the multi-WABA/multi-number switcher UI.

**Phase 2 — Reliability infrastructure**
Add Redis + BullMQ: broadcast/campaign send queue (replacing the blocking loops), retry queue with backoff, dead-letter queue, scheduled template-sync job; move rate limiting onto Redis so it works across instances; add an `AuditLog` model + middleware for admin/security-relevant actions.

**Phase 3 — Monetization**
Subscription plan model, UPI-based billing automation (UPI Autopay/intent-based collection + payment-status webhook reconciliation in place of a card gateway), usage-based metering (messages/conversations against Meta's conversation-based pricing categories), PDF invoice generation, billing section in the customer portal.

**Phase 4 — Portals & analytics**
Consolidate the three fragmented admin surfaces into one Admin portal; add a Partner/reseller portal; build out conversation-cost analytics and customer usage analytics; add template create/submit-for-review CRUD on top of the existing fetch-only integration.

**Phase 5 — Advanced product features**
AI chatbot integration (pluggable LLM), a workflow builder (wiring up the already-installed but unused `reactflow` dependency), external CRM connectors, and true shared-inbox agent assignment/ownership per conversation.

**Phase 6 — Hardening & compliance**
OpenAPI documentation, full unit/integration test coverage, remaining OWASP remediation, monitoring/APM (e.g. Sentry) + metrics, documented backup/restore strategy, DB index review under real query patterns, final removal of `bulk`/`src` duplication where it can be done without behavior change.

---

*This report reflects the state of the repository before any implementation work. No functional code was changed to produce it.*
