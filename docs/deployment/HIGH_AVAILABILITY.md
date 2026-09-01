# High Availability

What's actually HA in this codebase's current deployment shape today, and
— honestly — what isn't yet. See
[PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md) for the
component map and [SCALING.md](./SCALING.md) for the throughput side of
the same questions. See [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) for
what to do when HA isn't enough and you're actually recovering from an
outage.

## Multi-AZ for the managed tiers

- **MongoDB**: use a real multi-node replica set (Atlas's default
  multi-AZ cluster topology, or DocumentDB/Cosmos DB's equivalent
  multi-AZ options) rather than a single `mongod`. `MONGO_URI` accepts a
  standard replica-set connection string transparently — no code change
  needed on the app side.
- **Redis**: managed tiers (ElastiCache, Memorystore, Azure Cache) offer
  multi-AZ primary/replica failover even in single-node mode, and
  cluster-mode variants spread shards across AZs too. See
  [REDIS_AND_MONGODB_OPS.md](./REDIS_AND_MONGODB_OPS.md) for when to move
  from single-instance to `REDIS_CLUSTER_NODES`.
- **API/worker replicas**: spread across multiple AZs behind a load
  balancer (ALB, Front Door, Cloud Load Balancing, or an
  ingress-controller-fronted Kubernetes Service) so a single AZ outage
  doesn't take down every instance at once.

None of this requires application code changes — it's infra topology, and
the app's stateless-per-request design (JWT auth, Redis Socket.IO adapter)
is what makes it work once you've done it. See the cloud-specific guides
([AWS](./AWS_DEPLOYMENT.md), [Azure](./AZURE_DEPLOYMENT.md),
[GCP](./GCP_DEPLOYMENT.md)) for how to actually provision multi-AZ managed
tiers.

## What is NOT yet HA in this codebase — be honest about these

### In-process schedulers — now leader-elected, no longer N-fold duplicated

`backend/src/index.js` starts three schedulers unconditionally in every
API process that boots:

```js
startTokenRefreshScheduler();   // re-exchanges near-expiry WhatsApp Cloud tokens
startWhatsAppSendWorker();      // in-process broadcast-send worker (unless split out)
startInvoiceScheduler();        // generates usage-metered invoices
startBackupScheduler();         // optional, off unless ENABLE_SCHEDULED_BACKUPS=true
```

**Update:** all three (token refresh, invoice generation, scheduled backup)
now wrap their scheduled work in `withLeaderLock()`
(`nextjs/lib/services/schedulerLock.ts`) — a short-lived Redis `SET …
NX PX` lock per tick, so only one API replica actually executes the task on
any given cycle; every other replica's timer fires, fails to acquire the
lock, and skips silently. This closes the duplicate-billing risk on invoice
generation and the redundant-Graph-API-calls/duplicate-mongodump problems
described below in earlier revisions of this document. A dead lock holder
self-heals via TTL expiry rather than requiring an explicit release, and if
Redis itself is unreachable the lock check fails open (runs anyway) rather
than silently skipping scheduled work — the same risk profile this app
already accepted before leader election existed, not a new one.

`startWhatsAppSendWorker()` was never part of this problem — BullMQ's own
per-job locking already makes concurrent consumers across replicas safe
(see [SCALING.md](./SCALING.md)).

### Sticky WhatsApp Web sessions — no longer applicable

This section previously described a real structural limitation: the
unofficial WhatsApp Web transport held live socket connections in an
in-memory `Map<userId, SessionState>` per process, with no locking, leader
election, or session-ownership coordination. Running more than one API
replica risked reconnect storms and session invalidation, so the deployment
could not scale horizontally while that feature was in use.

**That transport has been removed entirely** (see
[`../BAILEYS_REMOVAL.md`](../BAILEYS_REMOVAL.md)). The Cloud API is stateless
HTTP — every replica can serve every tenant, and nothing in the messaging path
pins a user to a process. The constraint is gone, not merely gated: the API
tier now scales exactly as described in the "Multi-AZ" section above, with no
per-organization caveat.

### Single points of failure that remain even with the above addressed

- **MongoDB**, if not deployed as a real multi-node replica set — a
  single `mongod` (as in the dev `docker-compose.yml`) is a hard single
  point of failure regardless of API replica count.
- **Redis**, if left as a single instance rather than
  `REDIS_CLUSTER_NODES` — losing it takes down the send queue,
  real-time chat delivery across instances, and rate limiting all at
  once (though, per `docs/BACKUP_RESTORE.md`, without data-loss risk,
  since nothing in Redis is durable state).

## Summary: what a genuinely HA deployment of this app looks like today

- Managed, multi-AZ MongoDB replica set and Redis (with
  `REDIS_CLUSTER_NODES` once you need it) — both entirely infra-level,
  no app changes.
- Multiple API replicas behind a load balancer — safe given the Redis
  Socket.IO adapter and the scheduler leader election above. With the
  WhatsApp Web transport removed there is no longer any sticky-session
  caveat on this.
- Multiple standalone worker replicas (`backend/src/worker.js`) — safe by
  design, BullMQ handles concurrent consumers correctly.
- A platform-native (not in-process) scheduled backup job, per
  `docs/BACKUP_RESTORE.md`.

## Next steps

- [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) for the runbook when
  availability measures aren't enough and you're recovering from an actual
  incident.
- [SCALING.md](./SCALING.md) for the throughput-driven side of the same
  replica-count decisions.
