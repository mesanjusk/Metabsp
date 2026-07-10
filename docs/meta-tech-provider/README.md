# Meta Tech Provider Documentation

Everything needed to take this platform through Meta Business Verification,
Embedded Signup validation, App Review, and into commercial customer
onboarding as a WhatsApp Business Solution Provider (BSP) / Tech Provider.

| Doc | What it covers |
|---|---|
| [`BUSINESS_VERIFICATION.md`](./BUSINESS_VERIFICATION.md) | Verifying the Meta Business Manager account that owns the app |
| [`EMBEDDED_SIGNUP.md`](./EMBEDDED_SIGNUP.md) | How this app's Embedded Signup flow actually works, end to end |
| [`OAUTH.md`](./OAUTH.md) | The OAuth/token-exchange mechanics behind Embedded Signup and manual connect |
| [`WEBHOOK_SETUP.md`](./WEBHOOK_SETUP.md) | Registering, verifying, and securing the Meta webhook |
| [`SYSTEM_USER_CREATION.md`](./SYSTEM_USER_CREATION.md) | Generating and using a Business-owned System User token |
| [`ACCESS_TOKENS.md`](./ACCESS_TOKENS.md) | Token types, storage, refresh, and rotation in this codebase |
| [`APP_REVIEW.md`](./APP_REVIEW.md) | Meta App Review: required permissions, what to demonstrate |
| [`REQUIRED_PERMISSIONS.md`](./REQUIRED_PERMISSIONS.md) | The exact Graph API permissions this app needs and why |
| [`PRODUCTION_CHECKLIST.md`](./PRODUCTION_CHECKLIST.md) | Go-live checklist specific to this repo |
| [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) | Common failure modes and how to diagnose them in this codebase |
| [`CUSTOMER_ONBOARDING.md`](./CUSTOMER_ONBOARDING.md) | The actual customer-facing connect flow, including number migration |
| [`SUPPORT_GUIDE.md`](./SUPPORT_GUIDE.md) | Internal runbook for support staff handling customer issues |
| [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) | Where to start — points into `docs/deployment/` for the full infra guides |

All of these describe **what this specific codebase does today** — file
paths and env var names throughout are real, not illustrative. Where Meta's
own process is involved (App Review, Business Verification) and this repo
can't do it for you, that's stated explicitly rather than glossed over.
