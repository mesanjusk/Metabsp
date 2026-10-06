# Load & capacity testing

Run these tests against a local environment or a staging deployment that matches
the planned production database, Redis, and web-service tiers. **Do not run
synthetic webhook or stress traffic against production.** The webhook test
creates synthetic queue/message work, and high request volume can affect shared
staging services.

The Node scripts use Node's built-in fetch; no autocannon package is required.
Run commands from nextjs/:

| Test | Command | What it covers |
|---|---|---|
| Process health | npm run loadtest:health | GET /api/health; process and health-snapshot path |
| Signed WhatsApp webhook | META_APP_SECRET=... npm run loadtest:webhook | POST /webhook; HMAC verification and webhook acceptance |
| Authenticated API | AUTH_TOKENS_FILE=/secure/path/staging-jwts.txt npm run loadtest:api | Read-only, tenant-scoped GET /api/whatsapp/contacts by default |
| k6 health | k6 run loadtest/k6/health.js | Repeatable VU ramp and latency/error thresholds |
| k6 webhook | META_APP_SECRET=... k6 run loadtest/k6/webhook.js | Signed webhook VU ramp |

Use the production-shaped staging origin with explicit opt-in:

~~~bash
BASE_URL=https://staging.example.com \
ALLOW_REMOTE_LOAD_TEST=true \
LOADTEST_CONNECTIONS=50 \
LOADTEST_DURATION=30 \
npm run loadtest:health
~~~

The Node scripts default to http://localhost:3000, the app's local port.
They refuse non-local targets unless ALLOW_REMOTE_LOAD_TEST=true is set.
That flag only removes the guard; it does not make a target safe. Confirm the
URL is an environment you control before running a test.

## Authenticated API test

Create a local text file containing one JWT for each seeded staging account,
one token per line. Do not commit or upload this file. Blank lines and lines
starting with # are ignored. The script rotates requests across those tokens
and never prints them.

~~~bash
BASE_URL=https://staging.example.com \
ALLOW_REMOTE_LOAD_TEST=true \
AUTH_TOKENS_FILE=/secure/path/staging-jwts.txt \
LOADTEST_CONNECTIONS=100 \
LOADTEST_DURATION=60 \
npm run loadtest:api
~~~

The default read-only route is /api/whatsapp/contacts?page=1&limit=50.
Override it with LOADTEST_PATH=/same-origin/path. Use test accounts with
representative seeded data; one account cannot establish multi-tenant capacity.
Do not place real customer data or credentials in the load-test environment.

## Webhook test

META_APP_SECRET must match the staging server configuration so signatures
verify. The Node test generates unique synthetic message IDs. It does not call
the WhatsApp send API, but accepted requests can still create staging queue or
journal records; remove those test records after the run.

~~~bash
BASE_URL=https://staging.example.com \
ALLOW_REMOTE_LOAD_TEST=true \
META_APP_SECRET=staging-app-secret \
LOADTEST_CONNECTIONS=20 \
LOADTEST_DURATION=30 \
npm run loadtest:webhook
~~~

## Capacity run procedure

Start low, then increase concurrency (for example, 25 → 50 → 100 → 250 → 500
→ 1,000 virtual users) while watching service CPU/memory, MongoDB connections
and latency, Redis queue delay, webhook response times, errors, and background
worker backlog. Stop a step if errors rise, latency worsens sharply, or work
does not drain after the test. Do not infer support for a number of registered
accounts from virtual-user count alone; record the tested account count and
concurrency separately.

The Node runner prints request rate, p50/p95/p99 latency, HTTP status counts,
and transport errors. The k6 scripts use thresholds of p95 under 300 ms for
health and under 500 ms for webhook, with an error rate under 1%. These are
test thresholds, not a capacity guarantee.

These scripts do not prove full-product capacity. They do not load every
dashboard module, campaign send path, Socket.IO inbox traffic, media transfer,
or third-party provider. Never use the webhook benchmark to send real customer
messages. Run representative end-to-end flows separately with synthetic data
and provider sandboxes.

For an actual public-launch claim, keep the results with the tested commit,
deployment tier, database/Redis tier, seeded tenant count, virtual-user count,
duration, and any scaling changes. The repo cannot guarantee a throughput
number without results from the intended deployment.
