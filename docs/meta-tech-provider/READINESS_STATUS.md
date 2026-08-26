# Meta Tech Provider / App Review readiness

Updated 2026-08-26 after the rejected-submission audit and Render deployment hardening.

This report deliberately separates three kinds of requirements:

- **CODE** — can be proven and enforced by this repository.
- **RUNTIME** — depends on Render environment values and the running service.
- **EXTERNAL** — exists in Meta Business/App Dashboard or requires a human end-to-end test. Code must never claim these are complete when they are not.

## Current verdict

**Code/runtime deployment path: substantially hardened.** Render Blueprint auto-deploy is enabled and both web services now run a Meta deployment gate before installing/building. The backend additionally runs its Jest suite; Next.js runs TypeScript checking before its production build.

**Meta submission: not automatically certified.** Business Verification, App Review approval, exact dashboard URLs/domains and a real Embedded Signup/coexistence walkthrough remain external gates.

## Automated deployment gates

`render.yaml` now runs `scripts/meta-deploy-check.js` before each web-service build. It blocks deployment when required production configuration is absent or unsafe, including:

- `MONGO_URI`
- `REDIS_URL`
- `JWT_SECRET`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_EMBEDDED_SIGNUP_CONFIG_ID`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_TOKEN_ENCRYPTION_KEY`
- Graph API version below the repository's validated `v23.0` baseline
- webhook signature enforcement not set to `true`
- invalid/non-HTTPS canonical frontend URL in production
- obvious placeholder secret/config values

For the exact deployment that will be submitted to Meta, set `META_REVIEW_ENFORCE_READY=true` in Render. The gate will then additionally require:

- `META_REVIEWER_LOGIN`
- `META_REVIEWER_PASSWORD`
- `META_REVIEW_CONTACT_EMAIL`

Real reviewer credentials must stay in Render environment variables and must never be committed to this public repository.

## Render auto-deploy

Both `metabsp-backend` and `metabsp-nextjs` are explicitly configured with `branch: main` and `autoDeploy: true`.

Backend build gate:

```text
node ../scripts/meta-deploy-check.js && npm ci && npm test
```

Next.js build gate:

```text
node ../scripts/meta-deploy-check.js && npm ci && npm run typecheck && npm run build
```

Both services use `/api/health` as the Render health check. Redis is configured with `maxmemoryPolicy: noeviction`, which is appropriate for BullMQ-backed queues.

## Meta-side readiness matrix

| Requirement | Bucket | Status / action |
|---|---|---|
| Business Verification | EXTERNAL | Must show Verified in Meta Business Portfolio before submission. Cannot be completed from GitHub. |
| `whatsapp_business_messaging` | CODE + EXTERNAL | Implementation/submission text exists; approval is external. |
| `whatsapp_business_management` | CODE + EXTERNAL | Implementation/submission text exists; approval is external. |
| `business_management` | CODE + EXTERNAL | Keep justification narrow: manual-connect ownership validation only. Approval is external. |
| `public_profile` for WhatsApp review | CODE | Do **not** request it for this WhatsApp review. `FACEBOOK_LOGIN_SCOPES=public_profile` in Render belongs only to the separate optional Facebook social-login feature. |
| Embedded Signup config | RUNTIME + EXTERNAL | Config ID is required by deploy gate; actual Meta configuration and successful popup flow must be verified in production. |
| Webhook signature enforcement | CODE + RUNTIME | Required by deploy gate and existing backend preflight/tests. |
| Webhook callback URL | EXTERNAL + RUNTIME | Must be the live production callback in Meta Dashboard and must resolve successfully. |
| JS SDK Allowed Domains | EXTERNAL | Must contain every host used to run Embedded Signup. |
| Valid OAuth Redirect URI | EXTERNAL | Must exactly match the deployed production flow. |
| Coexistence webhook fields | RUNTIME + EXTERNAL | Existing backend preflight re-verifies subscriptions; still perform one real onboarding. |
| Real Embedded Signup / coexistence onboarding | EXTERNAL | Still mandatory before submission. No automated test can replace the real Meta popup/WABA flow. |
| Reviewer credentials | RUNTIME | Render deploy gate can enforce presence with `META_REVIEW_ENFORCE_READY=true`; human must verify login works in incognito. |
| Reviewer walkthrough video | EXTERNAL | Record only after the exact production deployment passes the end-to-end flow. |

## Graph API version

The previous readiness report was stale: `render.yaml` is now pinned to **v23.0**, not v20.0. Both `WHATSAPP_API_VERSION` and the legacy `META_API_VERSION` fallback are kept aligned. Embedded Signup uses ES v4 where configured.

Do not bump the Graph API merely to make the number newer immediately before App Review. Upgrade in a dedicated change and regression-test token exchange, phone-number lookup, WABA subscription, templates, send/receive, media and coexistence.

## Required human pre-submission run

Before clicking **Submit for Review**, use the exact deployed production URL and exact reviewer credentials in an incognito/private browser and verify:

1. Reviewer login succeeds without OTP or owner intervention.
2. WhatsApp dashboard is accessible.
3. **Connect with Meta** opens Embedded Signup without a JS SDK domain error.
4. A test WABA/number completes onboarding.
5. Connected phone/WABA details appear in the product.
6. WABA webhook subscription succeeds.
7. Template list/create flow works.
8. A real outbound WhatsApp message succeeds.
9. A real inbound message reaches the application webhook and appears in Chats.
10. Delivery/read status updates arrive.
11. If `business_management` is requested, demonstrate the manual-connect ownership-validation flow.
12. If Coexistence is offered, complete one real WhatsApp Business App coexistence onboarding.

Only after this run should the review video be recorded. The video, testing instructions and deployed build must demonstrate the same flow.

## Remaining non-code blockers

The repository cannot truthfully mark the following complete: Meta Business Verification, Meta permission approval, Meta dashboard domain/redirect/callback values, real WABA onboarding, reviewer account usability, reviewer video quality, legal review, production backup/restore drill, or support readiness. These must be checked in their owning systems.

## Submission recommendation

Do not submit solely because Render deploys successfully. Treat a successful Render deployment as **code/runtime gate passed**. Treat Meta submission as ready only when the external checklist above has also been completed and the exact production reviewer flow has been manually verified end to end.
