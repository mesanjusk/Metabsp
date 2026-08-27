# Meta Tech Provider Documentation

Everything needed to take this platform through Meta Business Verification,
Embedded Signup validation, App Review, and into commercial customer
onboarding as a WhatsApp Business Solution Provider (BSP) / Tech Provider.

**Start here:** [`SUBMISSION.md`](./SUBMISSION.md) — the single App Review
status document. The live status is not written down anywhere; it comes from

```
npm run submission-check --workspace=backend
```

which exits non-zero while any blocker remains.

| Doc | What it covers |
|---|---|
| [`SUBMISSION.md`](./SUBMISSION.md) | App Review go/no-go: what the check verifies, what only a person can |
| [`APP_REVIEW_SUBMISSION_TEXT.md`](./APP_REVIEW_SUBMISSION_TEXT.md) | Ready-to-paste justification and reviewer-instruction text |
| [`REQUIRED_PERMISSIONS.md`](./REQUIRED_PERMISSIONS.md) | The exact Graph API permissions this app needs and why |
| [`BUSINESS_VERIFICATION.md`](./BUSINESS_VERIFICATION.md) | Verifying the Meta Business Manager account that owns the app |
| [`EMBEDDED_SIGNUP.md`](./EMBEDDED_SIGNUP.md) | How this app's Embedded Signup flow actually works, end to end |
| [`COEXISTENCE.md`](./COEXISTENCE.md) | Coexistence — keeping the customer's WhatsApp Business app live on the same number |
| [`OAUTH.md`](./OAUTH.md) | The OAuth/token-exchange mechanics behind Embedded Signup and manual connect |
| [`WEBHOOK_SETUP.md`](./WEBHOOK_SETUP.md) | Registering, verifying, and securing the Meta webhook |
| [`SYSTEM_USER_CREATION.md`](./SYSTEM_USER_CREATION.md) | Generating and using a Business-owned System User token |
| [`ACCESS_TOKENS.md`](./ACCESS_TOKENS.md) | Token types, storage, refresh, and rotation in this codebase |
| [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) | Common failure modes and how to diagnose them in this codebase |
| [`CUSTOMER_ONBOARDING.md`](./CUSTOMER_ONBOARDING.md) | The actual customer-facing connect flow, including number migration |
| [`SUPPORT_GUIDE.md`](./SUPPORT_GUIDE.md) | Internal runbook for support staff handling customer issues |
| [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) | Where to start — points into `docs/deployment/` for the full infra guides |

These describe **what this codebase does today** — file paths and env var
names throughout are real, not illustrative. Where Meta's own process is
involved and this repo can't do it for you, that's stated rather than glossed
over.

Point-in-time audit and certification reports used to live here and at the
`docs/` root. They were deleted: they kept being read as current status, and
by the end they contradicted each other and the code. Status lives in the
check, not in a document.
