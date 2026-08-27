# MetaBSP

A multi-tenant WhatsApp Business Platform. A business connects its own WhatsApp
Business Account through Meta's Embedded Signup and manages customer
conversations from a shared team inbox.

Every message in and out goes through Meta's official **WhatsApp Cloud API**.
There is no other transport.

## Layout

| Path | What it is |
|---|---|
| `backend/` | Express API, webhook receiver, BullMQ workers. Deployed on Render. |
| `frontend/` | Vite + React dashboard. The app customers and reviewers actually use. |
| `nextjs/` | Partial App Router port. Not what serves production today. |
| `docs/meta-tech-provider/` | Everything about App Review, Embedded Signup, webhooks, tokens. |
| `docs/legal/`, `docs/api/`, `docs/deployment/`, `docs/videos/` | Policy templates, API reference, infra guides, walkthrough scripts. |

## Running it

```bash
npm install                 # workspaces: frontend + backend
cp backend/.env.example backend/.env
npm run dev:backend
npm run dev:frontend
```

The backend needs MongoDB and Redis. The frontend needs `VITE_API_URL`; there
is no hardcoded fallback, so a build that omits it fails visibly rather than
silently reaching production.

## Tests

```bash
npm test              # both workspaces
npm run test:frontend
npm run test:backend
```

The backend suite needs Redis on `127.0.0.1:6379` (without it, the rate-limit
and send-queue suites fail on `ECONNREFUSED` and Jest does not exit cleanly,
because BullMQ keeps retrying), and a MongoDB binary for
`mongodb-memory-server`, which it downloads on first run. Two suites depend on
that download; in a sandbox with restricted egress they are the only ones that
fail.

## Meta App Review

```bash
npm run submission-check --workspace=backend
```

Run it against production, with production's environment. It is read-only,
exits non-zero while any blocker remains, and prints the exact Meta App
Dashboard values to set. Start with
[`docs/meta-tech-provider/SUBMISSION.md`](./docs/meta-tech-provider/SUBMISSION.md).

The reviewer account a submission needs cannot be self-registered — signup
requires a WhatsApp-delivered OTP. Create it with:

```bash
REVIEWER_LOGIN=… REVIEWER_PASSWORD=… npm run seed-reviewer --workspace=backend
```
