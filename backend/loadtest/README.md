# Load & stress testing

Two toolchains, same two target endpoints — pick whichever is already in
your workflow. Neither is installed as a hard dependency of the app; both
scripts are opt-in tooling for benchmarking.

| Endpoint | autocannon | k6 |
|---|---|---|
| `GET /health` | `npm run loadtest:health --workspace=backend` | `npm run loadtest:health:k6 --workspace=backend` |
| `POST /webhook` | `npm run loadtest:webhook --workspace=backend` | `npm run loadtest:webhook:k6 --workspace=backend` |

**autocannon** ships as a devDependency (`npm install` already gets it) —
no separate binary to install. **k6** is a standalone Go binary, installed
separately: see https://k6.io/docs/get-started/installation/ (not
installed in this sandbox, so the k6 scripts here are written but
unexecuted here — verify them in an environment with k6 available before
relying on their exact thresholds).

## Why these two endpoints

- `/health` — no auth, no side effects. Establishes a latency/throughput
  floor for the process itself (routing + a Mongo ping) before layering on
  anything more expensive.
- `/webhook` — the highest-traffic real endpoint in production. Every
  inbound Meta message and status update hits it, and it does HMAC
  signature verification on every single request before touching the
  database — the endpoint most worth benchmarking specifically.

Authenticated JSON API routes (messaging, contacts, billing, ...) aren't
covered here: benchmarking them needs a valid JWT for a seeded test user,
which is a setup step specific to whatever environment you're testing
against rather than something this repo can script generically. Get a
token the normal way (log in against the target environment) and pass it
via an `Authorization: Bearer` header in a copy of these scripts.

## Running against the webhook endpoint

`META_APP_SECRET` must match whatever the **target server** is configured
with, so the precomputed signature actually verifies:

```bash
BASE_URL=http://localhost:5000 META_APP_SECRET=your-secret \
  npm run loadtest:webhook --workspace=backend
```

Only ever point this at a local or staging instance — it writes real
`Message` documents for the synthetic payload it sends, and repeated runs
will accumulate test data.

## Interpreting results

- **autocannon** prints p50/p97.5/p99 latency and requests/sec; both
  scripts exit non-zero if any response was non-2xx (investigate before
  trusting the latency numbers if that happens — a 5xx under load usually
  means something broke, not that it was just slow).
- **k6** is configured with explicit thresholds (`p(95)<300ms` for
  `/health`, `p(95)<500ms` for `/webhook`, `<1%` error rate) — it exits
  non-zero if a threshold is breached, which is the signal to treat as a
  regression in CI or a pre-launch gate.

Neither script claims a specific number this repo can guarantee in your
environment — CPU, network, and database placement all matter more than
the code paths being tested. Run them against your actual target
infrastructure before quoting a number to anyone.
