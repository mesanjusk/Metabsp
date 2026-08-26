# Meta App Review + Render auto-deploy readiness

This document separates what the repository can enforce automatically from what only Meta or a human reviewer can verify.

## Automatic code/runtime gates

Render builds now run `node ../scripts/meta-deploy-check.js` before installing/building the service. A non-zero result stops the deploy.

The gate verifies:

- `MONGO_URI`, `REDIS_URL`, `JWT_SECRET`
- `META_APP_ID`, `META_APP_SECRET`
- `META_EMBEDDED_SIGNUP_CONFIG_ID`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_TOKEN_ENCRYPTION_KEY`
- Graph API version syntax and minimum repo baseline (`v23.0`)
- webhook signature enforcement is `true`
- public URL is HTTPS when configured in production
- obvious placeholder secrets are rejected

For the final build intended for Meta App Review, set:

```text
META_REVIEW_ENFORCE_READY=true
META_REVIEWER_LOGIN=<working reviewer mobile/username>
META_REVIEWER_PASSWORD=<working reviewer password>
META_REVIEW_CONTACT_EMAIL=<monitored contact email>
```

Do not commit real reviewer credentials to Git. Keep all three as Render secrets (`sync: false`).

## Meta permissions for this submission

Request only the permissions the current WhatsApp implementation demonstrates:

- `whatsapp_business_messaging`
- `whatsapp_business_management`
- `business_management` only for the manual-connect ownership validation path

Do not request `public_profile` as part of the WhatsApp App Review. Facebook social login is a separate feature/use case.

## Manual/external gates — automation cannot mark these complete

Before pressing **Submit for Review**, a human must verify all of these in the actual Meta App Dashboard and production application:

- Business Verification shows verified/complete.
- Advanced Access/App Review request contains only the permissions above.
- App Domains and JavaScript SDK allowed domains contain every production/reviewer host used by Embedded Signup.
- Valid OAuth redirect URI points to the currently deployed application, not a legacy Render host.
- WhatsApp webhook callback points to the currently deployed webhook and verification succeeds.
- Required webhook fields are subscribed.
- The exact reviewer credentials work in a fresh private/incognito session.
- Reviewer can navigate to WhatsApp and launch **Connect with Meta**.
- Complete one real Embedded Signup flow end-to-end.
- Confirm connected WABA/phone details are persisted and visible.
- Confirm template list/create/status flow.
- Confirm a real inbound message reaches the inbox via webhook.
- Confirm an outbound message and delivery/read status flow.
- If `business_management` is requested, demonstrate manual connect and WABA ownership validation.
- If Coexistence is enabled, complete one real WhatsApp Business App coexistence onboarding end-to-end.
- Record the final review video against the same production deployment and reviewer flow.

## Render deployment behavior

`render.yaml` declares the Git branch and automatic deployment behavior for both web services. A push/merge to `main` can therefore trigger Render's normal Git auto-deploy, while the build-time readiness gate prevents deployment when mandatory runtime configuration is missing.

The gate does **not** claim that Meta has approved the app. Meta Business Verification, App Review approval, reviewer judgment, and dashboard configuration remain external state.

## Final submission rule

A green Render deployment means **code/runtime configuration passed**. It does not by itself mean **Meta submission approved/ready**.

For the final submission deployment:

1. Set `META_REVIEW_ENFORCE_READY=true` and the reviewer secrets in Render.
2. Deploy `main`.
3. Confirm Render build and health checks are green.
4. Run the complete manual/external checklist above.
5. Use `APP_REVIEW_SUBMISSION_TEXT.md` for the Meta review descriptions and reviewer instructions.
6. Submit only after the production video matches the exact flow described to Meta.
