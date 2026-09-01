# Meta Tech Provider / App Review readiness

Updated after the three-codebase consolidation (see `docs/CONSOLIDATION.md`).

This report separates three kinds of requirement, because conflating them is
how a submission goes out believing it is ready when it is not:

- **CODE** — provable from this repository.
- **RUNTIME** — depends on deployment environment values and the running service.
- **EXTERNAL** — lives in Meta's Business/App Dashboard, or needs a person to
  perform a real end-to-end run. Code must never claim these are complete.

---

## Verdict

**Code and runtime: materially stronger than before.** The product is one
deployment instead of three, the platform-level defects that would have failed
an authenticated review walkthrough are fixed, and the deploy gate refuses a
misconfigured release.

**Meta submission: still not certified, and cannot be from here.** Business
Verification, App Review approval, App Dashboard URLs and domains, and one
real Embedded Signup / coexistence onboarding remain external gates.

---

## Defects fixed in this pass

These were platform-level, not cosmetic. Each would have been visible to a
reviewer or, worse, to customers.

| Area | What was wrong | Severity |
|---|---|---|
| Multi-tenant isolation | Socket.IO accepted anonymous connections and broadcast every saved message to every connected client. Any visitor could receive all tenants' WhatsApp traffic. | Critical |
| Live inbox | The Chats panel read `import.meta.env` — Vite syntax that webpack compiles to `(void 0).VITE_SOCKET_URL`, throwing on load. The screen a review walkthrough spends most of its time on crashed. | Critical |
| Webhook durability | Inbound events were processed synchronously before acknowledging Meta — media download, Cloudinary re-upload and customer fan-out inside the request. Meta retries a slow webhook and eventually disables it. | High |
| Background workers | The queue producers had no consumer in this app. Broadcasts blocked for five minutes then timed out; delayed auto-replies and workflow steps were never delivered. | High |
| Token refresh | The scheduler that re-exchanges Meta long-lived tokens did not run here. Every connected number would stop sending ~60 days after onboarding, with no signal. | High |
| Consent | `ConsentDialog` — the disclosure of what the platform can do with a customer's WABA — existed but was never rendered. Access was granted with no disclosure. | High |
| API keys | Stored in plaintext and returned in full on every list call. | High |
| Key rotation | A rotated `WHATSAPP_TOKEN_ENCRYPTION_KEY` silently failed to decrypt every existing token, with no recovery short of re-onboarding every customer. | High |
| Security headers | No CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` or `Permissions-Policy`. `helmet()` was lost in the port. | High |
| CORS | No allow-list. Socket.IO reflected any origin with credentials enabled. | High |
| Broken links | `/signup`, `/privacy`, `/terms`, `/help`, `/docs` all 404'd — including the Privacy Policy and Terms links inside the consent dialog, which Meta checks. | High |
| Session lifetime | Tokens were hardcoded to 99 days while the deployment set `JWT_EXPIRES_IN=7d`; the variable had no effect. | Medium |
| Usage metering | Queried `direction:'OUTGOING'` while every write path stores `'outgoing'`, so metered overage was always zero. | Medium |
| Billing endpoints | The billing panel called `/api/billing/subscribe` and the invoice PDF route; neither existed in this app. | Medium |
| Unsigned uploads | A hardcoded Cloudinary cloud and unsigned browser upload preset — anyone could upload to the account. | Medium |
| Error disclosure | The public API returned raw internal errors (`connect ECONNREFUSED 10.0.0.5:27017`) to unauthenticated callers. | Medium |
| Dark mode | Server-rendered light styles outranked client dark ones, giving dark-OS visitors dark text on a light background. | Medium |
| Orphaned styles | Chat bubbles, the shared modal and the marketing footer were styled with Tailwind classes this app has no Tailwind to interpret. | Medium |
| Test coverage | The Express side had 43 test files; this app had none. | Medium |
| CI | No workflow built, typechecked or tested anything. | Medium |

## What can be proven from this repository

- Webhook signature verification is enforced and rejects unsigned, wrongly
  signed and unconfigured requests (`nextjs/tests/webhook.test.ts`).
- The webhook acknowledges Meta in ~15 ms and persists the payload to Redis
  before responding; a queue outage falls back to inline processing rather
  than a 5xx.
- Socket connections without a valid JWT are refused, and a message reaches
  only its owning user's room (verified against a running server).
- API keys are stored as SHA-256 hashes; the secret is returned once.
- Access tokens are AES-256-GCM encrypted, and rotation works in both
  directions.
- `/api/v1` authenticates before touching the database, rate limits per key,
  and never surfaces an internal error message.
- Security headers are present on every response; CORS is open on `/api/v1`
  without credentials and allow-listed everywhere else.
- 66 tests, a typecheck and a production build run in CI and again in the
  Render build.

## Deploy gate

`scripts/meta-deploy-check.js` runs before install and build. It blocks a
deployment when required configuration is absent or unsafe:

`MONGO_URI`, `REDIS_URL`, `JWT_SECRET`, `META_APP_ID`, `META_APP_SECRET`,
`META_EMBEDDED_SIGNUP_CONFIG_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
`WHATSAPP_TOKEN_ENCRYPTION_KEY`; a Graph API version below the validated
`v23.0` baseline; webhook signature enforcement not set to `true`; a
non-HTTPS canonical URL in production; obvious placeholder values.

For the exact deployment submitted to Meta, set `META_REVIEW_ENFORCE_READY=true`
so the gate additionally requires `META_REVIEWER_LOGIN`,
`META_REVIEWER_PASSWORD` and `META_REVIEW_CONTACT_EMAIL`.

---

## Meta-side readiness matrix

| Requirement | Bucket | Status |
|---|---|---|
| Business Verification | EXTERNAL | Must show Verified before submission. Not assertable here. |
| `whatsapp_business_messaging` | CODE + EXTERNAL | Implemented; approval is external. |
| `whatsapp_business_management` | CODE + EXTERNAL | Implemented; approval is external. |
| `business_management` | CODE + EXTERNAL | Keep the justification narrow: manual-connect ownership validation only. |
| `public_profile` | CODE | Do **not** request it for this review. It belongs only to the optional Facebook social sign-in. |
| Embedded Signup config | RUNTIME + EXTERNAL | Config ID required by the deploy gate; the popup flow must be verified in production. |
| Informed consent before signup | CODE | **Now enforced** — `ConsentDialog` gates every path to `FB.login`. |
| Webhook signature enforcement | CODE + RUNTIME | Enforced and tested. |
| Webhook callback URL | EXTERNAL + RUNTIME | Must point at the consolidated service's `/webhook` and resolve. |
| JS SDK Allowed Domains | EXTERNAL | Must list every host Embedded Signup runs from, scheme included. Unset means onboarding fails outright. |
| Valid OAuth Redirect URI | EXTERNAL | Must match the deployed flow. |
| Coexistence webhook fields | RUNTIME + EXTERNAL | Keep `META_ENABLE_COEXISTENCE=false` until the three fields are subscribed and one real onboarding is done. |
| Privacy / Terms / Data Deletion URLs | CODE + EXTERNAL | Pages exist and resolve; the dashboard values must be set to match. |
| Reviewer credentials | RUNTIME | The gate can enforce their presence; a human must confirm the login works in a private window. |
| Reviewer walkthrough video | EXTERNAL | Record only after the exact production deployment passes end to end. |

---

## Required human pre-submission run

On the exact deployed URL, with the exact reviewer credentials, in a private
window:

1. Reviewer login succeeds with no OTP and no owner intervention.
2. The dashboard loads and the Inbox renders.
3. **Connect with Meta** shows the consent dialog, then opens Embedded Signup
   with no JS SDK domain error.
4. A test WABA/number completes onboarding.
5. Connected phone/WABA details appear under Numbers.
6. WABA webhook subscription succeeds.
7. Templates list and template creation work.
8. A real outbound message is delivered.
9. A real inbound message reaches the webhook and appears in the Inbox.
10. Delivery and read receipts arrive.
11. If `business_management` is requested, demonstrate manual-connect
    ownership validation.
12. If Coexistence is offered, complete one real coexistence onboarding.

---

## Remaining non-code blockers

Meta Business Verification; permission approval; App Dashboard domain,
redirect and callback values; real WABA onboarding; reviewer account
usability; the review video; legal review of the published policies; a
production backup/restore drill; and support readiness. Each must be checked
in the system that owns it.

## Second pass — what was closed after the first report

| Gap | Now |
|---|---|
| Data retention documented but not implemented | Implemented (`nextjs/lib/services/dataRetentionService.ts`): a daily, leader-locked sweep over messages, inactive contacts and audit entries, deleting each message's Cloudinary media before its row, recording every run in the audit log. Windows default to 0 (keep forever) — set them to enforce a period. |
| CSP allowed `'unsafe-inline'` for scripts | Replaced by a per-request nonce with `'strict-dynamic'`, issued in middleware and picked up by Next for its own bootstrap. Verified in a browser: pages hydrate with zero violations and the nonce differs per request. |
| `xlsx` advisories with no registry fix | Dependency removed. CSV is parsed in-repo (RFC 4180 quoting, embedded commas and newlines, CRLF, BOM); `.xlsx` uses `read-excel-file`, which is clean, lazily imported. |
| `sharp` advisory via `next` | The image optimiser is off in `next.config.js` — nothing uses `next/image`, so that code is now unreachable rather than merely unused. |
| Operational docs citing pre-consolidation paths | 34 documents rewritten. Historical audit records are stamped and left as history. |
| A wrong encryption key failing silently | A boot self-check samples stored tokens and logs a CRITICAL naming `WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS` as the remedy. |
| Redis evicting queued messages silently | A boot self-check reads `maxmemory-policy` and logs an error when it is not `noeviction`. |

## Known gaps, stated plainly

- **The Cashfree billing integration is unverified** against live Cashfree
  documentation. It is off unless credentials are set, and self-service
  subscription returns a clear `503` until then. Verify against a sandbox call
  before accepting real payments.
- **The Redis instance backing the queues is misconfigured for this use.**
  It runs `maxmemory-policy=allkeys_lru` with persistence off, on the free
  plan. Queued inbound webhooks and outbound sends can be evicted under
  memory pressure, and are lost outright on a restart — silent customer
  message loss. This cannot be changed through the API; set it to
  `noeviction` in the Render dashboard, and move off the free plan for
  anything carrying real traffic.
- **The deployed service's build command does not run the deploy gate.**
  `render.yaml` describes the gated build, but the live service predates the
  blueprint and is configured by hand as `npm install && npm run build`. Set
  it to `node ../scripts/meta-deploy-check.js && npm ci && npm run typecheck
  && npm test && npm run build` so a misconfigured or failing release cannot
  reach Meta's webhook.
- **Next.js still pins vulnerable `postcss` and `sharp`.** `postcss` runs at
  build time over this repository's own CSS; `sharp` is unreachable with the
  image optimiser off. The real fix is a Next major upgrade, which pulls
  React 19 and MUI 7 with it — that deserves its own change and its own
  regression pass, not a cutover.
- **The Cashfree billing integration is unverified** against live Cashfree
  documentation. It is off unless credentials are set, and self-service
  subscription returns a clear `503` until then.
- **Retention windows are configured but set to 0**, meaning nothing is
  deleted. The mechanism is in place; choosing the periods is a legal and
  commercial decision.

## Submission recommendation

A successful deployment means the code and runtime gate passed. Treat the
Meta submission as ready only when the external checklist above is also
complete and the reviewer flow has been walked end to end by a person.
