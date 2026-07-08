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

### In-process schedulers run once per process, with no leader election

`backend/src/index.js` starts three schedulers unconditionally in every
API process that boots:

```js
startTokenRefreshScheduler();   // re-exchanges near-expiry WhatsApp Cloud tokens
startWhatsAppSendWorker();      // in-process broadcast-send worker (unless split out)
startInvoiceScheduler();        // generates usage-metered invoices
startBackupScheduler();         // optional, off unless ENABLE_SCHEDULED_BACKUPS=true
```

None of these have a distributed lock, leader election, or any mechanism
to ensure only one instance runs them. **Run N API replicas today and you
get N copies of the token-refresh scheduler, N copies of the invoice
scheduler, and — if `ENABLE_SCHEDULED_BACKUPS=true` — N copies of the
backup scheduler, all firing on their own independent timers.** Concretely:

- **Token refresh**: likely idempotent-ish in effect (re-exchanging an
  already-fresh token is probably harmless), but still N redundant calls
  to the Meta Graph API per cycle instead of 1 — wasted quota, and a risk
  if Meta's token-exchange endpoint isn't safe to call concurrently for
  the same account from multiple processes.
- **Invoice generation**: the higher-risk one — if
  `invoiceSchedulerService.js`'s query-then-generate logic has any window
  where two processes could both see a subscription as "not yet invoiced
  for this period" and both generate an invoice, that's a duplicate
  billing event. This has not been verified to be safe under concurrent
  execution across replicas; treat it as unverified rather than assuming
  it's fine.
- **Scheduled backups**: if `ENABLE_SCHEDULED_BACKUPS=true` across N
  replicas, you get N simultaneous `mongodump` runs against the same
  database on the same 24h cycle — wasted resources at best, load-spike
  contention at worst. This is exactly why `docs/BACKUP_RESTORE.md`
  recommends platform-native scheduling (a single cron job/CronJob) as
  "still the recommended default" over the in-process scheduler — that
  recommendation is doubly true once you're running more than one API
  replica.

**Mitigation for now**: either run exactly one API replica if these
schedulers matter to your deployment, or explicitly disable them (there's
no per-replica env flag for this yet — you'd need to fork the startup
logic or gate these calls behind an env var like `ENABLE_SCHEDULERS`
you'd add yourself) on all but one designated replica, and always leave
`ENABLE_SCHEDULED_BACKUPS=false` in favor of a platform-native scheduled
job outside the app process entirely, per `docs/BACKUP_RESTORE.md`.

### Baileys (WhatsApp-Web) sessions are in-memory, per-process, with no coordination

`backend/bulk/services/baileysService.js` keeps live WhatsApp-Web socket
connections in an in-memory `Map<userId, SessionState>`, and
`backend/src/index.js` calls `autoConnectIfCredentialsExist()` on **every**
boot of **every** process:

```js
server.listen(PORT, () => {
  ...
  const { autoConnectIfCredentialsExist } = require('../bulk/services/baileysService');
  autoConnectIfCredentialsExist().catch(...);
});
```

There is no locking, leader election, or session-ownership coordination
anywhere in this path. **If you run more than one API replica and the
bulk-invite/Baileys product surface has any linked WhatsApp-Web sessions,
every replica will independently try to open the same session on boot.**
WhatsApp-Web only tolerates one active connection per linked device —
multiple replicas fighting over the same session typically manifests as
reconnect storms, session invalidation, or one instance silently winning
while others spin retrying. This is the single biggest structural
obstacle to horizontally scaling the API tier as-is, if Baileys/bulk-invite
traffic is in active use.

**Mitigation for now**: if the Baileys/bulk-invite feature set is actively
used, run a single API replica (accepting that as the availability
trade-off) or route Baileys-dependent traffic to a dedicated
single-instance deployment separate from the horizontally-scaled Cloud-API
traffic, until session ownership gets a real distributed lock. If your
deployment only uses the Meta WhatsApp Cloud API surface (no linked
WhatsApp-Web/Baileys sessions), this caveat doesn't apply to you — the
Cloud API side (messages, templates, webhooks) has no equivalent
in-memory, single-owner state.

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
- Multiple API replicas behind a load balancer — safe for the Cloud-API/
  chat surface given the Redis Socket.IO adapter, **but only if** you've
  either accepted or mitigated the scheduler-duplication and
  Baileys-session risks above.
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
