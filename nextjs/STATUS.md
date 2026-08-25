# Next.js 15 migration — implementation status

See `docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md` at the repo root for the full audit,
architecture decision (Assumption AS-1: hybrid split), and rationale. This file
tracks what's actually implemented in this `nextjs/` app versus what's still on
the Express side, so the next work session can pick up without re-deriving scope.

## What this app is

The **stateless slice** of the Cloud API product: the Meta webhook, and (as
they get ported) the REST endpoints + dashboard UI. It shares the same
MongoDB Atlas cluster and the same Redis instance as `backend/`, which keeps
running unchanged for everything that cannot be serverless —
Socket.IO, the BullMQ `Worker`, and the four `setInterval` schedulers.

## Implemented

- **Foundation**: cached Mongo connection (`lib/db/mongo.ts`) and Redis
  singleton (`lib/db/redis.ts`), both using the `global.*` caching pattern
  Next.js needs (dev HMR + serverless cold-start reuse) that the original
  Express code didn't need. All 18 ported models use the
  `mongoose.models.X || mongoose.model(...)` guard for the same reason.
- **Models** (`lib/models/`): the 4 shared models (`User`, `Role`,
  `Organization`, `ApiKey` — same collections as `backend/bulk/models/`,
  intentionally NOT duplicated with divergent schemas) plus the 14 Cloud-only
  models (`WhatsAppAccount`, `Message`, `Contact`, `AutoReply`, `Workflow`,
  `CampaignMessageStatus`, `AuditLog`, `ConversationAssignment`,
  `ConversationOwner`, `WebhookDestination`, `CloudOtpVerification`,
  `Subscription`, `SubscriptionPlan`, `Invoice`). Every field/index/hook is
  ported to match `backend/src/repositories/*` and `backend/src/models/*`
  exactly — do not edit one side without the other until/unless the Express
  copies are retired.
- **Utils** (`lib/utils/`): `crypto.ts` (AES-256-GCM token encryption, same
  key), `password.ts` (scrypt legacy-compat), `logger.ts` (pino), `AppError.ts`,
  `normalizeNumber.ts`, `dateTime.ts`, `cloudinary.ts` — all ported unchanged
  from `backend/src/utils/*`.
- **WhatsApp Cloud API webhook** (`app/webhook/route.ts`,
  `app/api/whatsapp/webhook/route.ts`, both backed by
  `lib/whatsapp/webhookHandler.ts`) — the highest-priority item, since it's
  the actual pain point driving this migration. GET verification handshake
  and POST inbound-event handling, HMAC signature verification unchanged.
  **The one deliberate behavior change from the original**: all processing
  (message/status persistence, Contact upsert, media download + Cloudinary
  re-upload, keyword-routing fan-out, workflow/auto-reply matching) is
  `await`-ed before the response is sent, instead of the original's
  `setImmediate()` fire-and-forget-after-response pattern — see
  `docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md` §1.2/§1.6 for why the original
  pattern cannot be trusted on a serverless function. Delayed auto-reply/
  workflow-step sends (previously `setTimeout`) are now enqueued as delayed
  BullMQ jobs (`lib/queues/whatsappSendQueue.ts:enqueueDelayedReply`) onto
  the SAME queue (`whatsapp-broadcast-send`) and job shape the always-on
  host's existing, **unmodified** `Worker` already knows how to process —
  no change needed on the Express side for this to work.
- **Auth**: `lib/auth/jwt.ts` + `lib/auth/session.ts` (JWT sign/verify,
  DB-reverified `requireAuth`, same 99-day token as the original). Routes:
  `POST /api/users/login`, `GET /api/users/me`, `POST /api/users/logout`,
  `PUT /api/users/whatsapp-provider`, `POST /api/users/signup/request-otp`,
  `POST /api/users/signup/verify`, `POST /api/users/forgot-password/request-otp`,
  `POST /api/users/forgot-password/reset` — ported from
  `backend/src/routes/Users.js` with an identical request/response contract
  so the existing frontend's Cloud auth context (`frontend/src/context/AuthContext.jsx`,
  `frontend/src/apiClient.js`) can point at this app without its own changes.
- **Rate limiting** (`lib/http/rateLimit.ts`) — a small Redis fixed-window
  counter (INCR + PEXPIRE over the same shared Redis, fail-open on a Redis
  error/timeout) standing in for `express-rate-limit`/`rate-limit-redis`,
  which are Express-only. Applied to login (20/15min/IP), signup/forgot-
  password OTP request (5/15min/IP) and verify (10/15min/IP), and the
  authenticated connect/messaging endpoints (10/5min and 30/min per user,
  matching the original's `connectLimiter`/`messagingLimiter`).
- **Connect/account management** (`app/api/whatsapp/{connect,embedded-signup,account,accounts,status,meta-webhook-config}/*`)
  — embedded signup code exchange, manual connect, account list/get/activate/
  delete/disconnect/revalidate, status. Ported from
  `backend/src/controllers/whatsappController.js`'s connection-management
  section (lines ~309-817) via the shared `lib/whatsapp/connect.ts` helpers.
  Not yet ported: `PUT .../system-user-token`, `PUT .../manual` (account
  update) — lower priority, less frequently used than the connect flow.
- **Messaging** (`app/api/whatsapp/{send-text,send-template,send-media,send-message,broadcast}`)
  — ported from the same controller's message-dispatch section, reusing
  `lib/whatsapp/dispatch.ts` (built for the webhook) and a new
  `lib/whatsapp/twentyFourHourGuard.ts` (ported from
  `backend/src/middleware/whatsapp24hGuard.js`). `send-media` uses the Web
  `FormData`/`File` API instead of `multer` (Express-only) for uploads.
  **`broadcast` still blocks the HTTP response for up to 5 minutes**
  (`maxDuration = 300`), same as the original — flagged as a real risk in
  the migration plan (§1.2/§2.3) and NOT fixed here; a proper fix makes this
  fire-and-forget with a polling/status endpoint instead.
- `GET /api/health` — ported from `backend/src/app.js`.

## Not yet ported (in rough priority order for the next session)

1. **`PUT /api/whatsapp/account/:id/system-user-token`** and
   **`PUT /api/whatsapp/account/:id/manual`** (account update) — see
   `backend/src/controllers/whatsappController.js` lines ~717-810.
2. **Contacts CRUD, templates, conversations/messages read models +
   assignment, analytics, team members, campaigns** (the Cloud-API-side
   copy — see audit §1.3 on consolidating with the Bulk-side duplicate
   rather than porting both), **API key management**. Source of truth:
   `backend/src/controllers/whatsappController.js` (2239 lines) +
   `backend/src/routes/WhatsAppCloud.js`.
3. **Billing** (`/api/billing/*`) — Cashfree UPI Autopay integration; the
   original code's own comments flag its exact field/signature shapes as
   unverified against live Cashfree docs — verify before porting, don't
   assume the Express version is correct as a reference.
4. **Frontend dashboard UI** — none of `frontend/src/Pages`,
   `frontend/src/Components/whatsappCloud/*` has been ported into `app/`.
   This is the largest remaining workstream (full React Router → App Router
   rewrite, MUI SSR setup, the two-auth-context consolidation decision — see
   the main audit doc §1.1/§1.10).
5. **CORS / security headers** — `helmet()` and the custom CORS allowlist
   from `backend/src/app.js` have no Next.js-native equivalent wired up yet
   (`next.config.js` `headers()` only currently sets the no-cache rule for
   `/`, ported from the existing stale-cache fix).
6. **`send-message`'s request-forwarding approach** (`app/api/whatsapp/send-message/route.ts`)
   re-serializes the parsed body into a new `NextRequest` to forward to the
   dedicated `send-text`/`send-template`/`send-media` handlers, since a
   Request body can only be read once — works, but is a bit of an odd
   pattern; consider refactoring to shared handler functions instead of
   route-module re-exports if this needs to change again.

## Things deliberately NOT ported here (stay on `backend/`, unchanged)

Socket.IO server
(`backend/src/socket.js`), the BullMQ `Worker` (`backend/src/queues/whatsappSendWorker.js`
/ `backend/src/worker.js`), and the four `setInterval` schedulers
(`tokenRefreshService`, `invoiceSchedulerService`, `backupSchedulerService`,
`renderKeepAliveService`) — see the main audit doc §0 for why these
fundamentally cannot run as Vercel serverless functions. The entire Bulk
product (`backend/bulk/routes/*` other than the 4 shared models) is also
out of scope for this app.

## Deployment notes

- This app needs its own Vercel project (separate from the existing
  `frontend/` static-site Vercel project) with the env vars in
  `.env.example` set — critically, `MONGO_URI`, `REDIS_URL`, `JWT_SECRET`,
  and `WHATSAPP_TOKEN_ENCRYPTION_KEY` must be the EXACT SAME values as the
  always-on `backend/` host's, not new ones.
- Do not point Meta's webhook URL at this app until it has been tested
  against a non-production WABA — see the audit doc §2.7 (rollback plan)
  and §2.5 (risks) before cutover.
- `@socket.io/redis-emitter` is a new dependency introduced only in this
  app (not in `backend/package.json`) — it lets this app notify the
  always-on host's Socket.IO clients without hosting a socket server
  itself; see `lib/socket/emitter.ts`.
