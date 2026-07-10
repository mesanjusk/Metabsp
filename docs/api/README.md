# API documentation

| Doc | Covers |
|---|---|
| [`AUTHENTICATION.md`](./AUTHENTICATION.md) | JWT (first-party) vs. API key (`/api/v1`, third-party) — which to use |
| [`OAUTH.md`](./OAUTH.md) | The Meta OAuth mechanics behind account connection, for developers extending it |
| [`WEBHOOKS.md`](./WEBHOOKS.md) | This platform's own **outbound** webhook fan-out (not Meta's webhook into us — see `docs/meta-tech-provider/WEBHOOK_SETUP.md` for that) |
| [`SDK_EXAMPLES.md`](./SDK_EXAMPLES.md) | Node.js, React, and cURL examples against real endpoints |
| [`postman_collection.json`](./postman_collection.json) | Importable Postman collection covering the full API surface |

## Interactive reference

The full OpenAPI 3.0 spec is served live by the running backend at:

- `GET /api-docs` — interactive Swagger UI
- `GET /api-docs.json` — raw spec, for codegen or import into other tools

Source: `backend/src/docs/openapi.js`. That spec is the single source of
truth for request/response shapes — the examples in this folder
illustrate usage, not the full schema.
