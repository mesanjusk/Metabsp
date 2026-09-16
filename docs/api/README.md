# API documentation

| Doc | Covers |
|---|---|
| [`BUSY_ACCOUNTING.md`](./BUSY_ACCOUNTING.md) | BUSY URL configuration, scoped tokens, templates and PDF invoices |
| [`AUTHENTICATION.md`](./AUTHENTICATION.md) | JWT (first-party) vs. API key (`/api/v1`, third-party) — which to use |
| [`OAUTH.md`](./OAUTH.md) | The Meta OAuth mechanics behind account connection, for developers extending it |
| [`WEBHOOKS.md`](./WEBHOOKS.md) | This platform's own **outbound** webhook fan-out (not Meta's webhook into us — see `docs/meta-tech-provider/WEBHOOK_SETUP.md` for that) |
| [`SDK_EXAMPLES.md`](./SDK_EXAMPLES.md) | Node.js, React, and cURL examples against real endpoints |
| [`postman_collection.json`](./postman_collection.json) | Importable Postman collection covering the full API surface |

## Interactive reference

Open `/developers` in the dashboard for API examples, API keys, BUSY Accounting
setup and webhook destinations. `/developer-docs` contains the public overview.
The Next.js route handlers in `nextjs/app/api/v1/` define the current external API.
