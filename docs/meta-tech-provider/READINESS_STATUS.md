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
| `npm audit` reviewed on `backend/` and `frontend/` | **CODE** | Re-run 2026-08-25 — see below. The checklist's `[x]` is now stale. |
| Cashfree UPI Autopay verified against live docs | **EXTERNAL** | Untouched by design. Still a launch blocker if billing is enabled. |

### npm audit, re-run 2026-08-25

`xlsx` — **still no upstream fix** (`fixAvailable: false`). The checklist's
note remains accurate. It is a direct **production** dependency of the
frontend (spreadsheet import), so this is real runtime exposure, not a
dev-only finding. Options are unchanged: drop the feature, move parsing
server-side behind validation, or migrate to a maintained reader
(`exceljs`).

New since the checklist was written — **runtime** (production dependencies):

| Package | Sev | Path | Note |
|---|---|---|---|
| `react-router` / `react-router-dom` | high | frontend, direct | Open redirect via backslash in `<Link>`/`useNavigate`. This app performs auth redirects, so it is relevant. Non-breaking fix available. |
| `socket.io-parser` | high | via `socket.io` (backend) and `socket.io-client` (frontend) | Zero-attachment memory exhaustion. Non-breaking fix. |
| `dompurify` | moderate | via `jspdf@4.2.1` | A **new** advisory, not a regression of the one the checklist recorded as fixed. |
| `mongoose` | moderate | backend, direct | Prototype pollution in update casting. Non-breaking fix. |
| `nanoid` | high | via `postcss` (devDep) | Build-time only. |
| `protobufjs` | moderate | *(was via `@whiskeysockets/baileys`)* | **Resolved** — the dependency is removed. |
| `body-parser` | low | via `express` | Non-breaking fix. |

Dev/test-only, no runtime exposure: `vitest`, `vite`, `esbuild`, `vite-node`,
`@vitest/mocker`, `jsdom`, `canvas`, `tar` (critical, but reached only through
`jsdom` → devDependency), `@mapbox/node-pre-gyp`, `postcss`, `js-yaml`,
`brace-expansion`, `autocannon`/`hyperid`/`uuid`.

**Deliberately not fixed in this change.** Dependency bumps do not belong in a
PR whose stated scope is a health-check script, and the breaking upgrades
(`vitest@4`, `jsdom@30`) need their own test run. Recommended order: apply the
non-breaking runtime fixes (`react-router-dom`, `socket.io*`, `mongoose`,
`body-parser`) first and re-run both suites; handle `xlsx` as a product
decision; leave the dev-only breaking upgrades for a separate pass.

## Compliance / Operational

The Baileys item is now **CODE** and closed — the transport is removed
outright (`docs/BAILEYS_REMOVAL.md`), so there is no longer a business
decision to make about enabling it. The rest remain **EXTERNAL**: legal documents need a lawyer, not a linter; the data
retention policy is documented but **not implemented in code**, which the
checklist already flags; load testing, DR drills, and support training all
require a running environment and people.

## Graph API version

`WHATSAPP_API_VERSION` is pinned to **v20.0** in `render.yaml`. Meta's own App
Dashboard now generates token-exchange samples against **v25.0**, and the
Embedded Signup launcher reports **ES Version v4 / Session Info Version 3**.
Our code already sends `sessionInfoVersion: '3'`, which matches.

v20.0 predates Coexistence. Bumping is a change that touches every Graph call
in the app, so it is **not** included here — do it as its own change and
re-test ordinary send/receive afterwards.
