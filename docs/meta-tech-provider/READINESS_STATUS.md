# Production readiness — what is verifiable in code, and what is not

A line-by-line pass over `PRODUCTION_CHECKLIST.md`, splitting every item into
one of three buckets:

- **CODE** — provable from this repository alone. Automated where possible.
- **RUNTIME** — depends on the hosting environment (Render/Vercel env vars,
  Mongo, Redis, Sentry). Not knowable from git; the pre-flight check
  (`backend/src/services/preflightCheckService.js`) covers what can be checked
  from inside a running process.
- **EXTERNAL** — lives in Meta's dashboard, a lawyer's inbox, or a human's
  judgement. No code can close these.

The distinction matters because a green test suite says nothing about whether
`JWT_SECRET` is still `changeme` in production.

## Meta-side

| Item | Bucket | Status |
|---|---|---|
| Business Verification | EXTERNAL | Not verifiable here |
| App Review for `whatsapp_business_management` + `whatsapp_business_messaging` | EXTERNAL | Submitted 2026-07-13; **not approved**. Blocks production. |
| Embedded Signup config (`META_EMBEDDED_SIGNUP_CONFIG_ID`) | RUNTIME | Set → the connect endpoint returns it; unset → the UI falls back to manual connect. Covered by pre-flight only indirectly. |
| Webhook registered, verify token, signature enforcement | CODE + RUNTIME | Signature enforcement is on by default in code (`WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE`), tested in `webhookHardening.test.js`. Whether the URL/token are correct in Meta's dashboard is RUNTIME — **now checked** by pre-flight (`webhook_fields`, which also reports the registered `callback_url`). |
| Coexistence webhook fields subscribed | EXTERNAL → **now automated** | `history`, `smb_message_echoes`, `smb_app_state_sync`, `messages` **confirmed subscribed** in the App Dashboard (2026-08-25). Pre-flight now re-verifies this on every boot via `GET /{app-id}/subscriptions`. |
| One real coexistence onboarding, end to end | EXTERNAL | **Still open.** The remaining launch gate. |
| Primary number on a System User token | RUNTIME → **now automated** | Pre-flight's `token_sources` check reports `tokenSource` per active account and warns on `user_token`. |

## App configuration

| Item | Bucket | Why |
|---|---|---|
| Every var in `backend/.env.example` set to a real value | **RUNTIME** | `.env` is gitignored. Nothing in this repo can see production values, and a placeholder like `your_meta_app_secret` is indistinguishable from a real one at the type level. Partial coverage: pre-flight fails loudly if `META_APP_ID`/`META_APP_SECRET` are missing or rejected by Meta, and reports a decryption failure if `WHATSAPP_TOKEN_ENCRYPTION_KEY` is wrong. `JWT_SECRET`, `MONGO_URI`, `REDIS_URL`, `FRONTEND_URL` are **not** checkable — verify by hand in the Render dashboard. |
| `TRUST_PROXY` correct for the proxy topology | **RUNTIME** | Correctness depends on how many proxies sit in front of the app (Cloudflare → Render = 2 hops, direct = 1). `trustProxy.test.js` proves the setting is *read and applied* correctly; it cannot prove the *number* matches your real topology. Getting it wrong silently breaks rate-limiting by making every client share one IP. |
| `SENTRY_DSN` set | **RUNTIME** | `instrument.js` initialises Sentry only when the DSN is present and is otherwise a silent no-op — that's by design, and it's exactly why this can't be caught in code. Confirm in the Render dashboard. |
| Scheduled backups configured | **RUNTIME** | `backupSchedulerService` is off unless `ENABLE_SCHEDULED_BACKUPS=true` **and** `BACKUP_DIR` points at a persistent, ideally off-host mount. Code can verify the flag is read; it cannot verify the mount survives a container restart — on Render's ephemeral disk, a misconfigured `BACKUP_DIR` produces backups that vanish. Verify by restoring one. |

## Security

| Item | Bucket | Status |
|---|---|---|
| `npm audit` reviewed on `backend/` and `frontend/` | **CODE** | Re-run and **fixed** 2026-08-26 — see below. Every production advisory except `xlsx` is now closed. |
| Cashfree UPI Autopay verified against live docs | **EXTERNAL** | Untouched by design. Still a launch blocker if billing is enabled. |

### npm audit — re-run and fixed 2026-08-26

`npm audit --omit=dev` on the workspace root now reports **one** advisory:

| Package | Sev | Path | Status |
|---|---|---|---|
| `xlsx` | high | frontend, direct | **Open — no upstream fix** (`fixAvailable: false`) |

Everything else from the 2026-08-25 list is closed. `npm audit fix` applied
them all within the existing semver ranges, so **only `package-lock.json`
changed** — no `package.json` range was widened and no major version was taken:

| Package | Was | Now | Advisory |
|---|---|---|---|
| `react-router` / `react-router-dom` | 7.17.0 | 7.18.2 | Open redirect via backslash in `<Link>`/`useNavigate`. This app performs auth redirects, so it mattered. |
| `socket.io-parser` (via `socket.io` **and** `socket.io-client`) | 4.2.6 | 4.2.7 | Zero-attachment memory exhaustion |
| `mongoose` | 8.24.0 | 8.24.4 | Prototype pollution in update casting |
| `dompurify` (via `jspdf@4.2.1`) | 3.4.12 | 3.4.14 | New advisory, not a regression of the one fixed earlier |
| `body-parser` (via `express@4.22.2`) | <1.20.6 | 1.20.6 | Low |

Verified after the bump: frontend suite 48/48 green, frontend production build
green, backend suite green apart from the two environment-bound suites noted
below. The remaining dev/test-only findings (`vitest`, `vite`, `esbuild`,
`vite-node`, `@vitest/mocker`, `jsdom`, `canvas`, `tar`, `@mapbox/node-pre-gyp`,
`postcss`/`nanoid`, `js-yaml`, `brace-expansion`, `autocannon`/`hyperid`/`uuid`)
need breaking upgrades (`vitest@4`, `jsdom@30`) and carry no runtime exposure;
they stay deferred to their own pass.

#### `xlsx` — the one that needs a decision, not another deferral

It is a **direct production dependency of the frontend** (spreadsheet import),
so this is real runtime exposure. SheetJS publishes to its own registry rather
than npm, so `npm audit` will keep flagging it regardless of version. Three
options, unchanged: drop the import feature, move parsing server-side behind
validation, or migrate to a maintained reader (`exceljs`). Pick one before
launch and record it here.

### Running the backend suite

`npm test --workspace=backend` needs two things the repository cannot provide:

- **Redis on `127.0.0.1:6379`.** Without it, `rateLimit.test.js` and
  `whatsappSendQueue.test.js` fail on `ECONNREFUSED`, and jest does not exit
  cleanly afterwards because BullMQ keeps retrying the connection. Start a
  throwaway server first (`redis-server --daemonize yes --save '' --appendonly no`).
- **A MongoDB binary for `mongodb-memory-server`.** `tenantService.test.js` and
  `tokenRefreshService.test.js` call `MongoMemoryServer.create()`, which
  downloads from `fastdl.mongodb.org` on first run. In a sandbox with restricted
  egress that download is refused and both suites fail on the `beforeAll` hook —
  an environment limitation, not a code defect. Pre-seed the binary cache, or
  point `MONGOMS_SYSTEM_BINARY` at a local `mongod`, to run them.

Measured on 2026-08-26 with Redis running and the Mongo binary unavailable:
**41 of 43 suites pass**, and the only two failures are the pair above, both on
the `MongoMemoryServer.create()` download. Run them somewhere with that binary
before treating the suite as fully verified.

## Compliance / Operational

The Baileys item is now **CODE** and closed — the transport is removed
outright (`docs/BAILEYS_REMOVAL.md`), so there is no longer a business
decision to make about enabling it. The rest remain **EXTERNAL**: legal documents need a lawyer, not a linter; the data
retention policy is documented but **not implemented in code**, which the
checklist already flags; load testing, DR drills, and support training all
require a running environment and people.

## Graph API version

**Superseded — the v20.0 pin is gone.** `render.yaml` now sets both
`WHATSAPP_API_VERSION` and the legacy `META_API_VERSION` alias to **v23.0**, on
both the Express service and the Next.js service, matching what the Render
dashboard has set. v23.0 is comfortably past the version that introduced
Coexistence, so the "v20.0 predates Coexistence" objection no longer applies.

Meta's App Dashboard generates token-exchange samples against **v25.0** and the
Embedded Signup launcher reports **ES Version v4 / Session Info Version 3**. We
send `sessionInfoVersion: '3'`, which matches. Going further to v25.0 is
optional, not a blocker.

The remaining hazard was the *fallback*, not the pin: the hardcoded defaults in
`backend/src/config/graphApi.js` and `nextjs/lib/config/graphApi.ts` still read
`v20.0`, so any environment that failed to set the env var would silently drop
to a pre-Coexistence version — exactly the failure mode the `render.yaml`
comment records (production ran on v18.0 for months because the canonical key
was unset and the legacy alias won). Those defaults, the two
`loadFacebookSdk` client defaults, the dashboard's display fallback and both
`.env.example` files are now **v23.0**, so an unset variable degrades to the
version actually in production rather than to a three-year-old one.
