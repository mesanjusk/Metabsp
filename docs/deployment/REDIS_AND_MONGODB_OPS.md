# Redis and MongoDB Operations

Operational guidance specific to how this app actually uses its two
datastores. See [PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md)
for where these fit, and `docs/BACKUP_RESTORE.md` for backup/restore (not
duplicated here).

## Redis

### One Redis, three consumers

`nextjs/lib/db/redis.ts` exposes a single `getRedisConnection()`
singleton that three subsystems all share:

1. **BullMQ send queue** (`nextjs/lib/queues/whatsappSendQueue.ts` /
   `whatsappSendWorker.js`) — the broadcast-message job queue.
2. **Rate limiter** (`nextjs/lib/http/rateLimit.ts`) — sliding-window counters keyed by `req.ip` or user
   ID.
3. **Socket.IO Redis adapter** (`@socket.io/redis-adapter`, in
   `nextjs/lib/socket/server.js`) — pub/sub so `emit()` on one API instance
   reaches sockets connected to any instance. Note this opens a **second**
   connection specifically: `pubClient = getRedisConnection()` and
   `subClient = pubClient.duplicate()`, because pub/sub subscriber
   connections can't also run normal commands.

Size Redis for all three workloads combined, not just whichever one you
were thinking about first — a busy broadcast campaign (queue) at the same
time as a spike in chat activity (pub/sub) and a traffic spike hitting
unauthenticated endpoints (rate limiter) all draw on the same instance's
CPU/connection budget.

### Single instance vs. Cluster

Default is a single instance via `REDIS_URL`. Set `REDIS_CLUSTER_NODES`
(comma-separated `host:port`) instead to run against a Redis Cluster —
`getRedisConnection()` switches to `new IORedis.Cluster(...)`
automatically, and every consumer above (BullMQ, rate limiter, Socket.IO
adapter) uses whatever it gets back without caring which mode it's in.
Move to cluster mode when a single node's throughput becomes the
bottleneck, or when you want write availability across more than one node
— not by default "just in case," since cluster mode has real operational
cost (multi-key operations must hash to the same slot, `MULTI`/`EVAL`
across keys needs care).

BullMQ specifically requires `maxRetriesPerRequest: null` on its
connection (it manages its own retry/backoff for blocking commands) —
already set in both the single-instance and cluster branches of
`getRedisConnection()`, so nothing to configure yourself here.

### What you don't need to back up

Per `docs/BACKUP_RESTORE.md`: Redis holds only the BullMQ queue and
rate-limit counters, both ephemeral/reconstructable. Don't spend backup
budget on Redis snapshots (RDB/AOF) for disaster-recovery purposes — a
lost Redis just means re-triggering any in-flight broadcast and users'
rate-limit windows resetting, never real data loss. (You may still want
RDB/AOF turned on at the infra level purely to avoid a full
queue-draining hiccup on a Redis restart, which is an availability
concern, not a backup one.)

## MongoDB

### Connection pooling

The live application uses a deliberately small production pool in
`nextjs/lib/db/mongo.ts`:

```ts
await mongoose.connect(mongoURI, {
  autoIndex: false,
  serverSelectionTimeoutMS: 10_000,
  maxPoolSize: 10,
});
```

The 10-second server-selection timeout prevents a dead database from making an
HTTP request look hung for the driver's longer default window. The pool of 10
is intentional for the current shared/managed deployment shape: a zero-downtime
deploy briefly runs both old and new instances, so each process must leave
connection headroom. Increase it only from measured pool pressure and keep
`replicas × maxPoolSize` within the MongoDB tier's connection limit.

### `autoIndex` is disabled in production — index drift is now audited

`autoIndex: false` is unconditional. Request traffic never creates or drops
indexes implicitly.

The app now has an admin-only index auditor:

- `GET /api/system/indexes` compares every registered core Mongoose schema
  with the indexes that actually exist in MongoDB.
- It reports missing indexes, unexpected indexes and known dangerous legacy
  shapes.
- It explicitly detects the legacy globally-unique `Contact.phone` index
  that can block the same customer phone number from being stored by two
  different tenants.
- Collections that have never been used are reported but are not force-created.
- `POST /api/system/indexes` with
  `{"action":"create-missing"}` creates only missing indexes on collections
  that already exist. It never drops an index automatically.

Treat an index audit as a deployment/readiness gate after schema changes.
Review every reported extra/dangerous index manually before dropping it in
Atlas/mongosh. This is deliberately safer than running `syncIndexes()` on
production, which can silently drop an operator-created or legacy index before
the data has been checked.

### Read replicas / sharding

Not configured anywhere in this codebase today — `MONGO_URI` is a single
connection string, and the app doesn't route reads to secondaries or
shard keys anywhere in its query layer. At real scale, consider read
preference tuning (`readPreference=secondaryPreferred` for read-heavy,
staleness-tolerant queries like dashboard aggregates) before reaching for
sharding, which is a bigger operational commitment. See
[SCALING.md](./SCALING.md) for the honest, qualitative version of "when do
we need this."

## Backup/restore

Covered in full in [`docs/BACKUP_RESTORE.md`](../BACKUP_RESTORE.md) —
`nextjs/scripts/backup-mongo.sh`/`restore-mongo.sh`,
`ENABLE_SCHEDULED_BACKUPS`, and `nextjs/scripts/verify-restore.mjs`'s
restore-drill checks. Not duplicated here; see
[DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) for how that fits into an
RTO/RPO runbook.
