# Scaling

Concrete, honest scaling guidance for this specific codebase. See
[PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md) for the
component map and [HIGH_AVAILABILITY.md](./HIGH_AVAILABILITY.md) for the
availability side of the same questions.

## What's safe to run at N replicas today

**API servers**, mostly. `backend/src/app.js` is stateless per-request
(JWT auth, no server-side session), and `backend/src/socket.js` wires the
`@socket.io/redis-adapter` specifically so that `emit()` on one instance
reaches sockets connected to any other instance — without that adapter,
running more than one API instance would silently drop real-time
chat/notification events for a fraction of connected clients, proportional
to instance count. With `TRUST_PROXY` set correctly for your proxy chain
(see [NGINX_SSL_CLOUDFLARE.md](./NGINX_SSL_CLOUDFLARE.md) and the
cloud-specific guides), the Redis-backed rate limiter also behaves
correctly across instances.

**But** — read
[HIGH_AVAILABILITY.md](./HIGH_AVAILABILITY.md) before actually setting API
replicas above 1 in a deployment that has Baileys (bulk-invite/WhatsApp-Web)
traffic in active use, or that relies on the in-process schedulers
(token refresh, invoicing, scheduled backups). Those pieces run once *per
process*, with no leader election, so N API replicas today means N copies
of each of those, not one.

**The standalone worker** (`backend/src/worker.js`) is the one piece of
this app built from the ground up to run at N replicas safely. BullMQ
handles concurrent consumers on the same queue correctly (per-job locking,
no double-processing) — see `backend/src/queues/whatsappSendWorker.js`.
Scale this independently of the API's replica count: it has its own
resource profile (mostly outbound HTTP to the Meta Graph API and Mongo
writes, not inbound request handling), and scaling it doesn't touch
anything about API availability or Socket.IO correctness. This is exactly
the split `backend/src/worker.js`'s own comment describes: run the worker
in-process at low-to-moderate scale, split it into its own
deployment/replica set once broadcast-send volume needs to scale
independently of API capacity, or so an API crash/restart doesn't also
interrupt in-flight sends. See
[DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)'s `scale-workers` profile
or [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md)'s worker
Deployment for how to actually run this.

## Redis: single instance vs. Cluster

`backend/src/config/redis.js` defaults to a single Redis instance
(`REDIS_URL`), shared by the BullMQ queue, the rate limiter, and the
Socket.IO pub/sub adapter (see
[REDIS_AND_MONGODB_OPS.md](./REDIS_AND_MONGODB_OPS.md) for the full
breakdown of what draws on it). A single instance has a real, if
unmeasured, throughput ceiling — this repo has no load-test numbers
against Redis specifically to cite (see `backend/loadtest/README.md`,
which benchmarks `/health` and `/webhook` HTTP throughput, not Redis
directly). When you outgrow a single instance — symptoms would be BullMQ
job-processing latency climbing, rate-limiter checks adding noticeable
request latency, or Socket.IO event delivery lagging — set
`REDIS_CLUSTER_NODES` to move to Redis Cluster; no application code change
required, `getRedisConnection()` already branches on that env var.

## MongoDB at real scale

Not sharded or read-replica-aware anywhere in the current query layer —
`MONGO_URI` is a single connection string used for every read and write.
Reasonable next steps, roughly in order of operational cost:

1. **Read preference tuning** for specific read-heavy, staleness-tolerant
   queries (dashboard aggregates, reporting) — routing those to
   secondaries via `readPreference=secondaryPreferred` reduces primary
   load without any sharding work.
2. **Vertical scaling** of the Mongo tier (bigger instance, more RAM for
   working-set/index caching) — usually the highest-leverage, lowest-risk
   move before touching sharding.
3. **Sharding** — a real architectural commitment (choosing shard keys per
   collection, dealing with cross-shard queries) that this codebase
   doesn't currently anticipate anywhere in its schema design. Don't reach
   for this until vertical scaling and read-replica routing are both
   exhausted, and expect it to require actual schema/query changes, not
   just an infra change.

Also see [REDIS_AND_MONGODB_OPS.md](./REDIS_AND_MONGODB_OPS.md) for why
`autoIndex` is disabled in production and what that means for index
management as you add more collections/models.

## Honest capacity notes

This repo has no load-test numbers to cite for real production throughput.
`backend/loadtest/README.md` documents autocannon/k6 scripts against
`GET /health` and `POST /webhook`, but its own conclusion is explicit:
"Neither script claims a specific number this repo can guarantee in your
environment — CPU, network, and database placement all matter more than
the code paths being tested. Run them against your actual target
infrastructure before quoting a number to anyone." Treat any throughput
figure you hear for this app as unverified until you've run those scripts
(or equivalent load tests against your authenticated JSON routes, which
the existing scripts don't cover — see that README's note on needing a
real JWT for that) against your actual target infrastructure.

What actually determines your ceiling, qualitatively:

- **API tier**: CPU-bound on JSON (de)serialization and bcrypt/JWT work at
  low load; Mongo round-trip latency dominates once query volume rises.
  Horizontally scalable given the Redis adapter/rate-limiter fixes above.
- **Worker tier**: bound by the Meta Graph API's own rate limits per
  WhatsApp Business Account, not by this app's code — adding more worker
  replicas increases *concurrency*, not the ceiling Meta imposes per
  account.
- **Redis**: bound by single-instance throughput until `REDIS_CLUSTER_NODES`
  is configured.
- **MongoDB**: bound by the tier's IOPS/connection limits and, eventually,
  by not having sharding.

## Next steps

- [HIGH_AVAILABILITY.md](./HIGH_AVAILABILITY.md) — read this before
  raising API replica count in a bulk-invite/Baileys-active deployment.
- `backend/loadtest/README.md` for actually measuring before scaling.
