> **Historical record.** This document describes the repository before the
> three-codebase consolidation. Paths and architecture it names have moved;
> see `docs/CONSOLIDATION.md` for the mapping. Kept unedited as a record of
> what was decided and when.

# Metabsp → Next.js 15 / Vercel Migration — Audit & Plan (Phase 1 & 2)

> **Superseded on the Baileys question.** The unofficial WhatsApp Web
> transport described below has since been removed entirely — see
> [`docs/BAILEYS_REMOVAL.md`](./BAILEYS_REMOVAL.md). This document is
> retained as a point-in-time record and is not updated.

**Date:** 2026-07-28
**Status:** Pre-implementation checkpoint. **No functional code has been changed to produce this document.** Per the "zero-loss migration" mandate, this report must be reviewed and the architecture decision below confirmed before any Phase 3+ (actual code) work begins.

---

## 0. Executive summary — read this first

### What this repository actually is
Metabsp is **two products merged into one deployable backend + one deployable frontend**, not a single clean app:

| | "Cloud" product | "Bulk" product |
|---|---|---|
| Code | `backend/src`, `frontend/src/Pages`+`Components` (capitalized dirs) | `backend/bulk`, `frontend/src/pages`+`components` (lowercase dirs) |
| WhatsApp transport | Official Meta Cloud API (Graph API) | Unofficial Baileys (WhatsApp-Web protocol, QR pairing) |
| What it is | A real multi-tenant WhatsApp Business SaaS: billing (Cashfree UPI Autopay), subscriptions, invoicing, BullMQ-queued broadcast sends, Socket.IO live inbox, AI auto-reply (Anthropic), audit logs, RBAC, webhooks (inbound from Meta + outbound to customer systems), embedded signup | An older event-management + WhatsApp-Web automation product (campaigns, blasts, group import) |

Both run in **one Node process**, share **one MongoDB connection**, and share **one Socket.IO server instance**. This is confirmed current-state (an earlier audit dated three weeks ago is now stale on several points — Redis, BullMQ, the shared Mongo connection, and Sentry have all been added since).

### The core tension in the brief
The brief asks for "a single production-grade Next.js 15 application deployed entirely on Vercel" to eliminate Render free-tier sleep affecting the webhook. **Three subsystems in the current codebase cannot run inside a Vercel serverless function under any implementation, not just "with more work":**

1. **Baileys** (`backend/bulk/services/baileysService.js`) — holds a live, in-memory WebSocket session per WhatsApp number, connected to WhatsApp's own multi-device servers. There is no way to "reattach" to that live socket object from a new invocation; incoming messages are push-delivered with no polling fallback; the auto-reconnect-on-boot logic assumes a single process "starting up," which doesn't exist in a model with N concurrent, stateless, short-lived function instances.
2. **Socket.IO** (`backend/src/socket.js`, `@socket.io/redis-adapter`) — the live shared-inbox/notifications feature needs a server that holds open WebSocket connections indefinitely. A serverless function is invoked per request and torn down; it cannot host this.
3. **BullMQ `Worker`** (`backend/src/queues/whatsappSendWorker.js`, broadcast sending) and **four `setInterval`-based schedulers** (`tokenRefreshService`, `invoiceSchedulerService`, `backupSchedulerService`, `renderKeepAliveService`) all assume a persistent process. The `Worker` continuously long-polls Redis; the schedulers fire on a 24h/10-min timer that only exists because the Node process never exits.

Separately, the **webhook handler itself** (the thing this migration is nominally about) has a serverless-hostile pattern baked in today: it responds `200` immediately, then does all the real work — message persistence, media download + Cloudinary re-upload, keyword routing, workflow execution, a `setTimeout`-delayed auto-reply, AI-chatbot calls — inside a bare `setImmediate()` callback that runs *after* the response. That's safe only because the current process stays alive between requests. Ported unchanged to Vercel, it would silently drop inbound messages, status updates, and auto-replies whenever the runtime freezes the invocation post-response (which Vercel is free to do at any time once the response flushes).

### Recommended architecture: hybrid, not "everything on Vercel"
Given the above, **"single Next.js app, 100% on Vercel, zero exceptions" is not achievable without dropping real, working product features** (Baileys/Bulk campaigns, live Socket.IO inbox) or replacing them with different technology (a managed realtime provider, a different queue system) — both are product/scope decisions, not engineering details, and the user has not yet confirmed which to make. **This report proceeds on a documented, reversible default assumption** (flagged explicitly, not silently):

> **Assumption AS-1 (confirm or override before Phase 3+ coding begins):** Adopt a **hybrid split**. The stateless, request/response parts of the Cloud API product — the Meta webhook (fixed to await its work synchronously instead of `setImmediate`), all REST endpoints, the dashboard UI, billing, auth — move to Next.js 15 on Vercel. Baileys, Socket.IO, the BullMQ send worker, and the four `setInterval` schedulers stay on one always-on Node process (can be the existing Render service, upgraded off the free tier so it stops sleeping, or moved to another always-on host such as Fly.io/Railway) — **unchanged, zero rewrite risk to that code.** This directly and fully solves the stated pain point (Render free-tier sleep breaking the Cloud API webhook) with the lowest risk to the parts of the system that fundamentally cannot be serverless.

This was put to the user as an explicit multiple-choice question (hybrid vs. move-the-always-on-piece-elsewhere vs. drop Baileys vs. re-architect sockets/queues to be Vercel-native) and no answer was received in this session. **Everything below is written against Assumption AS-1.** If a different answer is chosen later, Phase 2's step list changes accordingly (see §2.9 "Alternatives not taken").

---

## PHASE 1 — Full project audit

### 1.1 Frontend architecture

**Two fully separate UIs sharing one Vite SPA build and one router**, `frontend/src/App.jsx` (173 lines, the real entry — loaded via `src/main.jsx` ← `index.html`). A root-level `frontend/main.jsx` also exists but is **100% dead code**: not referenced by `index.html`, imports `./App.jsx` and `./utils/offlineQueue.js`, neither of which exist at that path. The task brief's mention of "frontend/App.jsx" refers to this dead file — it does not actually exist on disk at all; only the root `main.jsx` does, and it's orphaned.

**Folder split:**
| | Pages | Components | Auth context | API client |
|---|---|---|---|---|
| Cloud | `src/Pages/` (5 files) | `src/Components/` (45 files, mostly `whatsappCloud/`) | `context/AuthContext.jsx` | `src/apiClient.js` |
| Bulk | `src/pages/` (30 files, incl. 14 public/marketing pages) | `src/components/` (17 files) | `context/BulkAuthContext.jsx` | `src/api.js` |

**Routing (full table in the underlying audit):** `/login`, `/cloud-signup`, `/cloud-forgot-password`, `/whatsapp` (Cloud); `/bulk-login`, `/signup`, `/forgot-password`, `/magic-login`, `/dashboard`, `/notifications`, `/admin`, `/whatsapp-bulk`, `/super-admin/settings`, `/roles`, `/users` (Bulk); five Cloud-API-flavored pages (`TechProviderDashboard`, `WhatsAppManagementPage`, `OnboardingWizardPage`, `SecurityDashboardPage`, `DocumentationPage`) are filed under the **Bulk** lowercase `pages/` dir and rendered through Bulk's shell — a real code-organization inconsistency to resolve during migration, not a misread. Plus 13 public marketing/legal routes and a 404.

**Known bugs surfaced by this audit (pre-existing, not introduced by migration):**
- The public marketing header's "Sign Up" button links to `/signup`, which renders the **Bulk** signup page, not Cloud's `/cloud-signup` — likely unintended.
- `LiveContext` (the socket event bus) reads `user` from `BulkAuthContext`, not the Cloud `AuthContext` — only Bulk-authenticated sessions drive the live socket join.
- The PWA is likely **non-functional today**: the only code path that calls `navigator.serviceWorker.register('/sw.js')` is the dead root `main.jsx`; the real entry point never registers it. `sw.js` has no `message` listener, so the "apply update" flow (`postMessage({type:'SKIP_WAITING'})`) does nothing. Treat all existing PWA code as unverified legacy, not a reference implementation for the migration.

**Auth:** both products are pure `localStorage` bearer-token schemes, no cookies, no SSR-safe session anywhere. This is a genuine blocker for naively lifting "protected routes" into Next.js Server Components/SSR — `localStorage` doesn't exist during server rendering, so protected pages need either a real cookie-based session or a client-only "protected shell" pattern in the new app.

**Two separate axios clients** (`api.js` for Bulk, `apiClient.js` for Cloud), each with **hardcoded production Render URLs as fallback defaults** if env vars are unset (`bulk-invite.onrender.com`, and a second hardcoded fallback in `socket.js`: `bkbackend-zr8f.onrender.com`). All `import.meta.env.VITE_*` reads are Vite build-time-only and bake straight into the client bundle — this is the entire "4 Render backends" naming that shows up in a recent commit title (see §1.7 — it turned out to mean something else entirely, not four separate deployed services).

**Cloudinary on the frontend:** a **direct-to-Cloudinary unsigned upload** (`whatsappCloudService.js`'s `uploadToCloudinary()`) with **hardcoded fallback credentials in source** (`dadcprflr` cloud name, `mern-images` preset) if env vars are unset — must confirm before migration whether this is a real, still-live account.

**Dependency hygiene:** frontend ships **three UI systems** (Bootstrap+react-bootstrap, MUI, Tailwind) but only MUI and Tailwind are actually used anywhere — Bootstrap is pure dead weight. About 15 more packages have zero imports anywhere (`reactflow` AND its deprecated predecessor `react-flow-renderer` — both unused; `react-hot-toast` AND `react-toastify` — both unused, real toasts are a hand-rolled `Toast.jsx`; plus `react-easy-crop`, `react-select`, `react-icons`, `lucide-react`, `react-pdf`, `react-loading-skeleton`, `react-floating-action-button`, `date-fns`, `file-saver`, `react-to-print`, `react-qr-code`). Separately, **`prop-types` is imported in 24 files but is not declared in `package.json` at all** — a phantom dependency that currently resolves only by luck via some other package's transitive install; this will break outright under Next.js/a different package manager and must be added explicitly regardless of anything else.

**No form library** anywhere (no react-hook-form/Formik/Yup/Zod) — all forms are hand-rolled `useState` + manual validation. The one shared convention worth preserving as-is is `utils/parseApiError.js` (normalizes varying backend error shapes into one displayable string).

**No path aliases** anywhere (pure relative imports) — this simplifies the migration (nothing to reproduce), but every relative import needs updating if the directory layout changes (e.g., merging `Pages`+`pages`).

### 1.2 Backend — Cloud API product (`backend/src`)

Single Express app (`backend/src/app.js`, importable without side effects for tests) started by `backend/src/index.js`, which additionally: connects Mongo, asserts the shared bulk connection, seeds the bulk admin, builds one shared Socket.IO instance, and starts **five long-running in-process background tasks** (token refresh, BullMQ send worker, invoice scheduler, backup scheduler, Render keep-alive pinger) plus Baileys auto-reconnect.

**Routes** (`backend/src/routes/`): `/api/v1` (API-key auth, proxies to Baileys), `/api/users` (auth/OTP/admin user mgmt), `/api/whatsapp` (the Cloud API surface — connection mgmt, send-text/template/media/message/broadcast, contacts, auto-reply, workflows, templates, conversations, analytics, team members, campaigns, api-keys, and a Baileys proxy), `/webhook` + `/api/whatsapp/webhook` (Meta's inbound webhook, same handler mounted twice), `/api/whatsapp/webhook-destinations` (self-service outbound fan-out with an SSRF guard), `/api/billing` (Cashfree UPI Autopay subscriptions/invoices), `/api-docs` (Swagger).

**Middleware:** `requireAuth`/`requireAdmin` (JWT, re-fetches the User from Mongo on every request, no claims-only trust), `requireApiKey`, **Redis-backed rate limiting** (`rate-limit-redis` over the shared `ioredis` connection, with a 2.5s timeout wrapper that fails open if Redis is unreachable), centralized error handler, `enforceWhatsApp24hWindow` (Meta's 24h session-messaging rule). `helmet()`, CORS allowlist, trust-proxy config, and raw-body capture for HMAC verification are configured directly in `app.js`.

**~20 services** in `backend/src/services/` — audited individually; the ones that are **pure request-driven Mongo/HTTP logic are fine to port as Next.js Route Handler logic as-is** (adminAnalyticsService, aiChatbotService, auditLogService, billingService's calculation logic, conversationAssignmentService, invoicePdfService, otpService, paymentGatewayService, teamService, tenantService, usageMeteringService, whatsappAccountService, whatsappCredentialValidationService, whatsappHealthService, whatsappMediaService, workflowService). **Four services cannot run as Vercel functions without redesign** because they are `setInterval`-based background loops:
- `tokenRefreshService.js` — daily Meta access-token refresh. **The single most business-critical item to get right**: a missed refresh eventually invalidates a tenant's WhatsApp connection.
- `invoiceSchedulerService.js` — daily billing; its own code comments flag duplicate execution as a real billing-correctness risk.
- `backupSchedulerService.js` — additionally shells out to the `mongodump` binary and writes to persistent local disk, neither of which exist in a Vercel Function at all.
- `renderKeepAliveService.js` — solves a Render-specific problem; simply deletable once the webhook itself is off Render (though see §1.7 — the sibling `WebhookDestination` URLs it also pings are a separate, user-owned concern).

**Queues (`backend/src/queues/`):** BullMQ producer (`whatsappSendQueue.js`, `Queue.add`/`addBulk`, 3 retries with exponential backoff, acts as its own dead-letter inspection via `getFailed()`) is safe to call from a Vercel Function. The **`Worker`** (`whatsappSendWorker.js`, consumer side) is not — it long-polls Redis continuously and needs a persistent process; `backend/src/worker.js` already exists as a ready-made standalone entrypoint for exactly this split. Separately, `POST /api/whatsapp/broadcast` currently **blocks the HTTP response for up to 5 minutes** waiting on `waitForJobResults` — already incompatible with Vercel's function timeouts (10s Hobby / 60s Pro default) regardless of where the worker lives, and needs to become fire-and-forget-with-polling.

**The WhatsApp webhook (most critical section):**
- GET verification handshake (`verifyWebhook`) is a trivial, fully portable stateless check against `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- POST inbound handler (`receiveWebhook`, `backend/src/controllers/whatsappController.js:1778-2080`): validates `x-hub-signature-256` (HMAC-SHA256 over `req.rawBody`, `crypto.timingSafeEqual`, gated by `WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE`) — **this part is stateless and portable as-is.** Then responds `200` immediately and does *all* real processing — status/message persistence, Contact upsert, media download + Cloudinary re-upload, keyword-routing fan-out to `WebhookDestination`s (with its own retry/backoff), workflow execution, auto-reply matching (including a multi-second `setTimeout`-delayed reply), and AI-chatbot calls — inside `setImmediate()`. **This is the single highest-risk item in the entire migration**: it must be rewritten to `await` all of that work synchronously before responding (raising an execution-time budget concern — media download + Cloudinary upload alone can take several seconds per attachment, and Meta batches multiple `entry`/`changes` per call) or handed to a durable queue (which again needs an always-on worker, per the point above).
- Access tokens are stored **AES-256-GCM encrypted** (`backend/src/utils/crypto.js`, the live copy — `backend/utils/crypto.js` at the repo-root level is a dead, orphaned duplicate with zero live imports, safe to delete), with key-rotation support via a `_PREVIOUS` key env var.
- Embedded Signup (`completeEmbeddedSignup`) does the full OAuth code → short-lived → long-lived token exchange, then explicitly calls `subscribeAppToWaba()` since Meta does not auto-subscribe a WABA to webhooks on its own.
- Graph API version is centralized in `backend/src/config/graphApi.js` (`WHATSAPP_API_VERSION`, default `v20.0`).

**Socket.IO (`backend/src/socket.js`):** live inbox updates (`new_message` events), backed by `@socket.io/redis-adapter` over the same Redis connection as BullMQ/rate-limiting, so it works across horizontally-scaled instances. Confirmed: **fundamentally incompatible with serverless functions** — needs a persistent connection-holding server.

**Auth:** JWT (`jsonwebtoken`), 99-day expiry, header-based only (`Authorization: Bearer`), no refresh-token mechanism, re-verifies the DB user on every request (no stale-claims trust path). OTP flow is 6-digit/10-min-TTL, delivered via the platform's own legacy-env WhatsApp number (not a tenant's connected number, since a new registrant has no 24h session with any tenant yet).

**Two `utils/` directories exist** — `backend/src/utils/` (live, actively imported) and `backend/utils/` (repo-root, an older/simpler duplicate set including a non-rotating single-key `crypto.js`) — confirmed **zero live imports** of the root-level copy anywhere in the app or test suite. Safe to delete during migration rather than port forward.

**Mongo/Redis connection pattern:** both `config/mongo.js`'s implicit Mongoose singleton and `config/redis.js`'s explicit lazy singleton are designed as "connect once per process, reuse forever" — correct for a long-lived Express process, and **directionally the right pattern for Next.js too**, but neither currently has the specific "cached global promise surviving hot-reload" guard Next.js needs (see §1.4).

### 1.3 Backend — Bulk/Baileys product (`backend/bulk`)

Mounted under `/api/bulk/*` on the same Express app/process as Cloud. Routes cover auth (login/magic-login), org signup+OTP, dashboard summary, generic CRUD for `Role`/`Notification` (via a factory that does **raw mass-assignment of `req.body` into Mongoose with no field allowlist** — a pre-existing security gap, not migration-introduced, but worth fixing during the rewrite), user CRUD + bulk import, a Bulk-specific WhatsApp Cloud-ish sub-feature (`whatsappRoutes.js`, its own webhook/inbox/send, distinct from `backend/src`'s), the actual Baileys control surface (`baileysRoutes.js`: connect/disconnect/status/inbox/rules/groups), blasts (full CRUD but **no send implementation exists anywhere** — an incomplete/dead feature), campaigns (its own send loop + a `setInterval` 60s scheduler that starts merely by requiring the route file), and system settings.

**Baileys (`baileysService.js`) — why it fundamentally cannot be serverless, concretely:**
1. `makeWASocket()` returns a live object wrapping an **open outbound WebSocket** to WhatsApp's servers, held only in a process-memory `Map` (`sessions`). There is no way to "resume"/"reattach" to that object from a different process or a later invocation — the object itself, not just its logical state, would need recreating.
2. WhatsApp's multi-device protocol expects a continuously-connected client (`keepAliveIntervalMs: 25_000`); closing/reopening the socket per-request looks to WhatsApp like an anomalous device takeover (close code 440), which Baileys' own reconnect logic treats as requiring a fresh QR scan, not a routine reconnect.
3. **Incoming messages are push-delivered** over the open socket with no polling/webhook alternative — if nothing is listening between invocations, messages are missed.
4. Live connection state (QR-pending, reconnect counters) exists **only in process memory**; only auth *credentials* persist to Mongo (`baileysAuthState.js`, with its own process-local write-through cache in front of every DB read, deliberately, because the handshake can't tolerate per-key Mongo round-trip latency — another reason a cold serverless instance changes timing characteristics Baileys wasn't built to tolerate).
5. `autoConnectIfCredentialsExist()` (invoked once at Express boot) sequentially reconnects every saved session — meaningless in a platform with no single "process startup" and potentially many concurrent stateless instances with no shared memory.

**Confirmed duplicate/competing broadcast logic:** two independent, near-identical hand-rolled Baileys broadcast senders operate on the same `Campaign` collection — one in `backend/bulk/routes/campaignRoutes.js` (writes `BaileysMessage` audit-log rows, scopes ownership by `permissions.includes('*')`), one in `backend/src/routes/WhatsAppCloud.js` (does **not** write audit-log rows, scopes ownership by a different `isAdmin` flag). A migration should consolidate to one canonical implementation (ideally queue-based, matching the pattern already used for genuine Cloud API sends) rather than porting both forward.

**Already fixed / not blockers:** the two-Mongo-connection split (`backend/bulk/config/db.js` is now a no-op assertion, not a second `connect()` call) and the two-Socket.IO-instance concern (bulk's `socket.js` is just a 14-line façade holding the *same* `io` instance `backend/src` created) are both confirmed clean today — an earlier audit's claims to the contrary are stale.

### 1.4 Database (MongoDB / Mongoose)

**30 Mongoose models total** — 8 in `backend/src/models`, **6 more hiding in `backend/src/repositories`** (including `WhatsAppAccount`, the single most important model in the Cloud product), and 16 in `backend/bulk/models`. Full field/index/relationship documentation exists in the underlying audit; headline points:

- **The per-phone-number uniqueness constraint** the brief asked about is a **partial unique index on `WhatsAppAccount.phoneNumberId`**, scoped globally (not per-user), active only where `numberClaimed: true` (a boolean proxy needed because Mongo partial-filter expressions only support equality, not `$ne`). Backed up at the app layer by `whatsappAccountService.assertPhoneNumberAvailable`.
- **Access tokens are AES-256-GCM encrypted** — but *only* `WhatsAppAccount.accessTokenEncrypted` (Cloud product). The Bulk product's `WhatsAppConnection.accessTokenMasked` stores only a display string; real Bulk send-time credentials come from env vars, not this document. **`BaileysAuthState.dataValue` stores raw WhatsApp-Web session/auth material in plaintext with no encryption at all** — arguably the most sensitive at-rest gap in the whole schema, since a leaked doc could let someone impersonate an active session.
- **No model anywhere uses Mongoose's `select: false`** — every sensitive field (`password`, `accessTokenEncrypted`, `ApiKey.key`, `WebhookDestination.secret`, `BaileysAuthState.dataValue`, `magicToken`) is returned by a plain default `find`/`findById` unless the calling code remembers to `.select('-password')` by hand. Pre-existing, not migration-introduced, but a Route Handler naively returning a Mongoose doc as JSON must preserve the same manual-exclusion discipline.
- **`User`, `Organization`, `Role`, `ApiKey` are genuinely shared** — one collection each, imported directly across the `src`/`bulk` boundary. A migration must not duplicate these model definitions into two separate directories; the safest approach is one shared `lib/models/` both product areas import from, mirroring today's reality.
- **Biggest migration-mechanics risk:** none of the 30 models use the `mongoose.models.X || mongoose.model(...)` guard, and there is no cached-global-connection-promise helper — both are close to mandatory for Next.js's execution model (dev-mode hot reload re-executes model files; serverless cold starts need a reused, not reopened, connection). This is a **mechanical, repo-wide fix required across all 30 model files** before this code can run correctly under Next.js dev/HMR — not optional, not something that can be skipped.
- **Production disables Mongoose's `autoIndex` entirely** (to avoid crash-looping a shared/free Atlas tier by eagerly creating ~30 collections' worth of indexes at boot). Consequence: **none of the indexes documented in the audit are guaranteed to exist on the live Atlas cluster** — they depend on manual one-off scripts (`create-order-indexes.js`, `migrate-whatsapp-account-uniqueness.js`) having actually been run in that environment. **This must be verified against the real production Atlas cluster (`db.<collection>.getIndexes()`) before cutover**, since the app's uniqueness guarantees (most importantly the phone-number ones) depend on these indexes existing, not just on the application-level checks that back them up. There's also a code comment warning Atlas may still carry a stale *global* unique index on `Contact.phone` predating the current per-user-scoped one.
- An orphaned index script (`create-order-indexes.js`) references an `orders` collection with no matching model anywhere in the repo — confirm directly against Atlas whether this collection has real documents before deciding whether to leave it alone or investigate further.

### 1.5 Authentication

One shared JWT scheme (`getJwtSecret()`, `JWT_SECRET` with `ACCESS_TOKEN_SECRET` as a legacy fallback) issues a single 99-day, header-only bearer token — no refresh-token rotation, no cookies. Every request re-verifies against the DB (`User.findById(...).populate('roleId')`), so there's no stale-claims trust window, but also nothing that would let a Next.js Server Component check auth without a network round-trip (or a cookie-based session, which doesn't exist today). Role/permission model: `roleId.permissions` array of strings, `'*'` = superuser. OTP-based signup/password-reset exists on both products, independently implemented (Cloud's `CloudOtpVerification` has no TTL index and must be cleaned up manually; Bulk's `OtpVerification` has a real Mongo TTL index — an inconsistency worth normalizing). Password hashing: bcrypt on `User` (shared model) with a legacy-scrypt-or-plaintext fallback that transparently re-saves as bcrypt on first successful legacy login — a live in-place migration path still active in the model, must be preserved.

### 1.6 WhatsApp Cloud API integration — see §1.2 for full detail; summarized here as requested

Verification ✅ portable as-is. Signature validation ✅ portable as-is (stateless HMAC). Response-then-process pattern ❌ **must be rewritten** before this can safely run on Vercel (see §0 and §1.2). Outgoing text/template/media sends ✅ portable (raw `axios` calls to Graph API, no serverless-specific issue). Media upload/download ✅ portable as functions, but currently invoked from inside the risky `setImmediate` block. Templates ✅ CRUD is a thin Graph API proxy, portable. Interactive messages: dispatch primitives exist; portable. Embedded Signup token exchange ✅ portable, but **explicitly flagged in its own docs as not yet exercised against a live, App-Review-approved Meta app** — a real pre-launch verification gap independent of this migration. Retry/backoff: BullMQ sends get 3 retries; webhook-destination fan-out gets 2 retries with fixed delays; direct (non-queued) sends get no retry at all.

### 1.7 Cloudinary

Server-side (signed, via the SDK, `backend/src/utils/cloudinary.js`) — used for inbound/outbound WhatsApp media and the Bulk upload endpoint; fine to keep exactly as-is in a Next.js API route/Server Action. Client-side (unsigned, direct-to-Cloudinary from the browser, `whatsappCloudService.js`) — no backend round-trip by design, but **has hardcoded fallback credentials in source** (flagged in §1.1) that must be confirmed as dev-only placeholders before shipping the new app. **No explicit delete flow found anywhere** — media is uploaded but never cleaned up via the Cloudinary API.

### 1.8 External APIs — purpose, risk, replacement need

| Integration | Purpose | Server/Client | Replacement needed? |
|---|---|---|---|
| Meta Graph API | Core WhatsApp Cloud API | Server | No — keep, this is the point of the product |
| Cloudinary | Media storage | Both (signed server + unsigned client) | No — keep |
| Anthropic API (`@anthropic-ai/sdk`) | Optional AI auto-reply | Server | No — keep; fully inert if `ANTHROPIC_API_KEY` unset |
| Sentry (`@sentry/node`) | Error tracking | Server | Consider swapping to `@sentry/nextjs` post-migration for better Next.js-runtime instrumentation |
| Cashfree (UPI Autopay) | Billing/subscriptions | Server | No — keep, but **its exact field/signature shapes are explicitly flagged in the code's own comments as unverified against live Cashfree docs** — a pre-existing launch blocker for billing, not migration-introduced |
| `qrcode` | Baileys QR pairing | Server | Tied to Baileys' fate (see AS-1) |

### 1.9 Environment variables — complete table

The full cross-referenced table (backend + frontend, every variable's purpose/consumer/client-vs-server/Next.js migration note) lives in the underlying audit and is reproduced here in full for completeness:

**Backend (server-only secrets — must never get a `NEXT_PUBLIC_` prefix):**
`PORT`, `NODE_ENV`, `MONGO_URI`, `FRONTEND_URL` (+ legacy alias `CLIENT_URL`), `TRUST_PROXY`, `ENABLE_SCHEDULED_BACKUPS`, `BACKUP_DIR`, `REDIS_URL`/`REDIS_CLUSTER_NODES`, `JWT_SECRET` (+ legacy alias `ACCESS_TOKEN_SECRET`), `JWT_EXPIRES_IN`, `BOOTSTRAP_USERNAME`/`_NAME`/`_PASSWORD`, `SUPER_ADMIN_USERNAME`/`_NAME`/`_MOBILE`/`_PASSWORD`, `CLOUDINARY_CLOUD_NAME`/`_API_KEY`/`_API_SECRET`, `META_APP_ID`, `META_APP_SECRET` (+ undocumented alias `WHATSAPP_APP_SECRET`), `WHATSAPP_API_VERSION` (+ stale legacy fallback `META_API_VERSION`, pinned to `v18.0` in `render.yaml` vs. the canonical `v20.0` default), `META_EMBEDDED_SIGNUP_CONFIG_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (+ undocumented aliases `WHATSAPP_VERIFY_TOKEN`/`VERIFY_TOKEN`), `WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE`, `WHATSAPP_TOKEN_ENCRYPTION_KEY`(+`_PREVIOUS`), `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` (legacy platform-wide OTP number), `WHATSAPP_WABA_ID`/`WHATSAPP_BUSINESS_ACCOUNT_ID`/`WABA_ID` (three undocumented aliases, pick one), `WHATSAPP_OTP_TEMPLATE_NAME`/`_LANGUAGE` (undocumented), `CASHFREE_ENV`/`_CLIENT_ID`/`_CLIENT_SECRET`/`_API_VERSION`, `ANTHROPIC_API_KEY` (documented in `.env.example` but **absent from `render.yaml`** — confirm it's actually set in the Render dashboard), `SENTRY_DSN`/`_TRACES_SAMPLE_RATE` (same absent-from-render.yaml note), `LOG_LEVEL` (same note), `RENDER_KEEP_ALIVE_URLS`/`ENABLE_RENDER_KEEP_ALIVE` (undocumented, Render-specific, delete post-migration).

**Frontend (build-time, client-exposed via Vite's `VITE_` prefix today — needs `NEXT_PUBLIC_` prefix or a server-side proxy in Next.js):**
`VITE_API_LOCAL`, `VITE_API_SERVER` (Cloud API base), `VITE_SOCKET_URL` (has a hardcoded Render fallback in source), `VITE_API_URL` (Bulk API base, also has a hardcoded Render fallback in source), `VITE_CLOUDINARY_CLOUD_NAME`/`_UPLOAD_PRESET` (both have hardcoded fallback values in source — confirm liveness before shipping), and one fully undocumented dead alias `VITE_API_BASE` (drop, don't carry forward).

### 1.10 Dependencies audit

**Backend** — categorized in full in the underlying audit. Headline: `express`, `helmet`, `express-rate-limit`, `multer`, `swagger-ui-express` all need Next.js-native replacements (Route Handlers, `next.config.js` headers, a Next.js-compatible rate-limit approach, Web `Request`/`FormData` for uploads, a Next.js-compatible OpenAPI UI). `@whiskeysockets/baileys`, `bullmq` (Worker side), `socket.io`+`@socket.io/redis-adapter` all "need architectural rework" per AS-1 (stay on the always-on host, don't try to port into Vercel functions). Everything else (`@anthropic-ai/sdk`, `axios`, `bcryptjs`, `cloudinary`, `ioredis`, `jsonwebtoken`, `mongoose`, `pdfkit`, `pino`, `qrcode` (tied to Baileys' fate)) is a clean keep.

**Frontend** — `react-router-dom` is the single biggest migration item (full rewrite of the routing layer onto Next.js App Router file-based routing, not a swap). `vite`/`vitest`-the-build-tool goes away entirely (Next.js's own bundler). **~15 packages have zero imports anywhere and are strong candidates to drop rather than carry forward**: `bootstrap`+`react-bootstrap`, `reactflow`+`react-flow-renderer` (both, including the deprecated one), `react-hot-toast`+`react-toastify` (both), `react-easy-crop`, `react-select`, `react-icons`, `lucide-react`, `react-pdf`, `react-loading-skeleton`, `react-floating-action-button`, `date-fns`, `file-saver`, `react-to-print`, `react-qr-code`. `prop-types` must be added as an explicit direct dependency (currently an undeclared phantom dependency riding on some other package's transitive install — see §1.1). `xlsx` (SheetJS) is separately flagged in the project's own `PRODUCTION_CHECKLIST.md` as having no upstream npm fix for known CVEs as of that writing — re-verify current status before shipping the new app, don't assume it's resolved.

### 1.11 Performance / dead code findings

- Dead files confirmed safe to delete: root `frontend/main.jsx`, `frontend/src/styles.css`, `frontend/src/components/Navbar.jsx`, `frontend/src/services/uploadService.js`, `frontend/src/components/{ViewSwitchToolbar,ConsentDialog,WhatsAppConsentBanner}.jsx`, `frontend/src/Components/MobileContainer.jsx`, `frontend/public/offline.html`, `frontend/public/version.json`, `frontend/assets/*.svg` (6 files), root-level `backend/utils/` (entire directory — dead duplicate of `backend/src/utils/`).
- Duplicate/competing logic to consolidate rather than port twice: the two Baileys campaign-broadcast implementations (§1.3); at least 3 near-duplicate phone-number-normalization helpers scattered across the Cloud controller/routes.
- N+1 query pattern in `adminAnalyticsService.getAdminOverview` (per-tenant-group `await` inside `.map()`) — not urgent, but a natural thing to consolidate into one aggregation if this data-loader gets rewritten for a Next.js Server Component.
- `WhatsAppBlast` (Bulk) has full CRUD but **no send implementation anywhere in the codebase** — an incomplete feature, candidate to retire rather than migrate.
- Mass-assignment gap in `backend/bulk/routes/crudRoutes.js` and several inline controllers (`req.body` spread directly into `Model.create`/`findOneAndUpdate` with no field allowlist) — pre-existing security debt, a natural fix-while-touching item during the rewrite.

---

## PHASE 2 — Migration plan

### 2.1 Current architecture (as-is)

```
                         ┌─────────────────────────────┐
  Browser ──HTTPS──────▶ │ Vercel: static Vite/React SPA│
                         │ (frontend/dist, 2 product UIs)│
                         └───────────────┬──────────────┘
                                         │ REST + Socket.IO (2 axios clients,
                                         │ hardcoded Render URLs as fallback)
                                         ▼
                         ┌──────────────────────────────────────────┐
                         │ Render (free tier — sleeps after ~15 min) │
                         │ ONE Node process:                          │
                         │  Express app.js (Cloud + Bulk routes)       │
                         │  Socket.IO server (+ Redis adapter)         │
                         │  BullMQ Worker (in-process)                 │
                         │  4× setInterval schedulers                  │
                         │  Baileys session manager (in-memory)        │
                         └───────────────┬──────────────┬─────────────┘
                                         │              │
                                    MongoDB Atlas    Redis (Render add-on)
                                (30 models, 1 shared conn)
```
External: Meta Graph API (webhook + sends), Cloudinary, Cashfree, Anthropic, Sentry. A GitHub Actions cron plus an in-process pinger exist purely to keep the Render service (and user-registered `WebhookDestination` URLs) from sleeping — this whole subsystem is the direct cause of the pain point driving this migration.

### 2.2 Target architecture (per Assumption AS-1)

```
                         ┌──────────────────────────────────────────┐
  Browser ──HTTPS──────▶ │        Vercel: Next.js 15 App Router       │
                         │  app/ (Server + Client Components)          │
                         │  app/api/ (Route Handlers):                 │
                         │    - Meta webhook (GET+POST, synchronous)   │
                         │    - all Cloud REST endpoints                │
                         │    - billing/Cashfree                        │
                         │    - BullMQ producer only (enqueue)          │
                         └───────────────┬──────────────┬─────────────┘
                                         │              │
                                    MongoDB Atlas    Redis (managed, e.g. Upstash
                              (same 30 models,     or keep the existing instance)
                               same connection
                               string, unchanged)
                                         ▲              ▲
                                         │              │
                         ┌──────────────────────────────┴─────────────┐
                         │ Always-on Node host (Render paid tier, or   │
                         │ Fly.io/Railway — per AS-1)                   │
                         │  Socket.IO server (+ Redis adapter)          │
                         │  BullMQ Worker (consumer)                    │
                         │  4× setInterval schedulers (unchanged code)  │
                         │  Baileys session manager (unchanged code)    │
                         │  Bulk product's Express routes (unchanged)   │
                         └──────────────────────────────────────────────┘
```
The Next.js app and the always-on host share the same MongoDB Atlas cluster and the same Redis instance — no data migration, no schema change, no dual-write period. The webhook, being the actual pain point, moves fully to Vercel and stops depending on Render's uptime. The always-on host stops needing Render's *free* tier specifically (a paid tier, or a different always-on provider, ends its own sleep problem too) but keeps every line of Baileys/Socket.IO/scheduler code unchanged.

### 2.3 Migration steps (high-level, ordered)

This is a **plan outline for Phase 3+ execution, not yet executed.** Each step should land as its own reviewable, independently-shippable change:

0. **Confirm Assumption AS-1** (or an alternative) with the user before any code moves. Confirm the Cashfree integration's field/signature shapes against live docs if billing is in scope for launch (pre-existing gap, not migration-caused, but should not be silently carried forward as "presumed working"). Confirm on the live Atlas cluster that the index set documented in §1.4 actually exists.
1. **Foundation fixes that must happen regardless of AS-1's outcome**, since they're needed either way: add `mongoose.models.X ||` guards to all 30 model files; add a cached-global-connection-promise helper for Mongo (and confirm Redis's existing lazy singleton is safe to reuse under Next.js); delete confirmed-dead code (`backend/utils/`, dead frontend files listed in §1.11); add `prop-types` as an explicit frontend dependency; remove confirmed-unused frontend dependencies (§1.10) one PR at a time with a real build/bundle check after each removal (not just the static-grep evidence this audit used).
2. **Rewrite the webhook handler's response-then-process pattern** to `await` all work synchronously (or hand it to the BullMQ producer, still consumed by the always-on worker) — this is the one piece of business logic in scope that must change behavior, not just move files, and deserves its own isolated PR with webhook-specific tests (replaying real Meta payload shapes) before anything else touches it.
3. Scaffold the Next.js 15 App Router project structure (see Phase 3 below) and port the **stateless** Cloud API routes one vertical slice at a time (e.g., auth+users, then WhatsApp connection management, then messaging, then billing), each slice keeping its existing request/response contract byte-for-byte so the existing frontend (even before its own migration) keeps working against it.
4. Port the frontend from the Vite SPA to Next.js App Router, product-slice by product-slice, preserving the existing route paths where reasonably possible to avoid breaking any bookmarks/deep links/Meta Embedded Signup popup callback URLs.
5. Stand up the always-on host for Socket.IO/BullMQ-Worker/schedulers/Baileys (reusing the existing Render deployment upgraded off the free tier is the lowest-risk first move; a different host is a later, independent decision).
6. Re-point Meta's webhook URL, the frontend's API base, and the socket connection URL at the new Vercel app / always-on host respectively; run both old and new in parallel behind a feature-flag or DNS-level staged cutover (see §2.7).
7. Decommission the old Render web service and the render-keep-alive workaround (both the in-process pinger and the GitHub Actions cron) once cutover is verified stable — but only the parts that exist purely to work around Render sleep; if the always-on host chosen in step 5 is still Render (just paid), the keep-alive subsystem becomes unnecessary and should be deleted rather than ported.

### 2.4 Breaking changes

- Every frontend env var (`VITE_*`) renames to `NEXT_PUBLIC_*` or moves server-side — anything hardcoding the old names (build scripts, CI, documentation) needs updating.
- The webhook's internal processing timing changes (synchronous instead of fire-and-forget) — functionally more correct, but response latency to Meta increases somewhat; must stay well within Meta's and Vercel's timeout budgets (see §2.5 risks).
- File-upload handling (`multer`) needs a different implementation under Next.js Route Handlers' Web `Request`/`FormData` API — request shape for `sendMedia`/upload endpoints may need adjustment even if the external HTTP contract stays the same.
- Two axios clients / two auth contexts either get consolidated (recommended, since the products already share one router/build) or explicitly kept parallel in the new app — a decision to make explicitly during Phase 3, not by default.

### 2.5 Risks (ranked)

1. **Webhook correctness during/after the `setImmediate` rewrite** — highest severity, since a bug here silently drops real customer messages. Mitigate with a replay-based test harness using real captured Meta payload shapes before cutover.
2. **Token-refresh scheduler continuity** — if the always-on host has any gap in coverage during cutover, WhatsApp connections can silently expire (Meta tokens are ~60-day lived with only a 7-day refresh margin). Mitigate by standing up the always-on host and verifying its scheduler is running *before* decommissioning the old Render service, not after.
3. **Index existence on production Atlas** — unverified assumption per §1.4; must be checked before cutover since the app's own uniqueness guarantees depend on it.
4. **Baileys session continuity during any host migration** — sessions are in-memory; moving the always-on host (step 5, if chosen to be a non-Render provider) requires either a planned reconnect window (users may need to rescan QR codes) or careful sequencing so credentials in Mongo remain valid across the cutover.
5. **Encryption key migration** — `WHATSAPP_TOKEN_ENCRYPTION_KEY` is explicitly documented (`docs/meta-tech-provider/ACCESS_TOKENS.md`) as **not covered by any Mongo backup**; it must be copied to the new environment's secrets store as its own explicit step, or every stored access token becomes permanently undecryptable.
6. **Hardcoded fallback URLs/credentials in frontend source** (Render URLs, Cloudinary cloud name/preset) silently pointing a misconfigured build at the wrong backend/account — must be removed, not just have their env vars renamed.

### 2.6 Estimated effort (rough, for planning purposes only)

| Workstream | Relative size |
|---|---|
| Foundation fixes (§2.3 step 1) | Small — mechanical, low-risk, can start immediately |
| Webhook rewrite + test harness | Medium — small diff, high care required |
| Cloud API route porting (vertical slices) | Large — the bulk of the backend migration effort |
| Frontend port to Next.js App Router | Large — full routing-layer rewrite, MUI SSR setup, two-auth-context decision |
| Always-on host stand-up + cutover | Medium — mostly deployment/ops work, code unchanged |
| Testing (webhook replay, auth, billing, uploads, Baileys smoke test) | Medium-Large |

This is not a single-PR change — expect a genuinely multi-week program of work executed in the incremental, independently-shippable slices described in §2.3, not a big-bang rewrite.

### 2.7 Rollback plan

Because Assumption AS-1 keeps the always-on host's code completely unchanged, rollback at any point before full cutover is simple: point the frontend/Meta webhook URL back at the still-running old Render deployment. Recommend a staged cutover (webhook URL first, once its rewrite is verified in a private test app/WABA; then the dashboard frontend; billing/Cashfree last, given its own already-flagged unverified-against-live-docs status) rather than an all-at-once switch, so any single slice can roll back independently without affecting the others.

### 2.8 Deployment & testing strategy (outline — detailed checklists belong in Phase 11/12 once implementation begins)

- Vercel project for the Next.js app; environment variables per the table in §1.9, converted per the client/server rules stated there.
- Always-on host keeps its existing `render.yaml`-style config (or an equivalent for whatever host is chosen), minus the keep-alive workaround.
- Testing must specifically include: webhook signature verification against real Meta payloads, the rewritten synchronous processing path under realistic media-download latency, token-refresh-scheduler continuity, Baileys reconnect behavior after any host move, and a full regression pass of billing/Cashfree given its pre-existing unverified status.

### 2.9 Alternatives not taken (recorded for the decision this report is checkpointed on)

- **Re-architect sockets/queues to be Vercel-native** (replace Socket.IO with a managed realtime provider such as Pusher/Ably, replace in-process schedulers with Vercel Cron + an external queue trigger like Upstash/QStash): possible, but a materially larger rewrite with more surface area to get wrong, and was one of the options explicitly offered to the user without a response yet.
- **Drop Bulk/Baileys entirely**: would make "single Next.js app, 100% Vercel" fully achievable with no hybrid split, but is a product decision (retiring a working, already-gated-behind-a-feature-flag feature set), not an engineering one — also offered without a response yet.
- **Move the always-on piece to a non-Render host** (Fly.io/Railway/a VPS) instead of upgrading the existing Render service: functionally equivalent to AS-1, purely a hosting-provider choice; can be decided independently of and later than the Vercel migration itself.

---

## Manual steps required before/around cutover (not code changes)

- Confirm the four undocumented-but-live env vars/aliases (`WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`/`VERIFY_TOKEN`, `WHATSAPP_WABA_ID`/`WABA_ID` family, `CLIENT_URL`) are either consolidated to one canonical name or explicitly still supported, and update `.env.example`/`render.yaml` accordingly.
- Confirm `ANTHROPIC_API_KEY`, `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `LOG_LEVEL` are actually set in whatever dashboard currently hosts the running service (they're documented in `.env.example` but absent from `render.yaml`).
- Migrate `WHATSAPP_TOKEN_ENCRYPTION_KEY` (and `_PREVIOUS` if set) to the new environment's secret store as an explicit, separate step from any Mongo data — it is not part of any DB backup.
- Update the Meta App Dashboard's webhook callback URL once the new Vercel-hosted handler is verified.
- Verify the real Atlas index set against §1.4 before/after cutover.
- Decide the fate of the hardcoded Cloudinary fallback credentials (`dadcprflr`/`mern-images`) — confirm whether that account is real/live and rotate access if so.

---

*This report reflects the state of the repository as of 2026-07-28. No functional code was changed to produce it. Phase 3 (actual implementation) should not begin until Assumption AS-1 (§0) is confirmed or overridden by the user.*
