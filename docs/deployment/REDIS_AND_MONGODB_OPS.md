# Redis and MongoDB Operations

Operational guidance specific to how this app actually uses its two
datastores. See [PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md)
for where these fit, and `docs/BACKUP_RESTORE.md` for backup/restore (not
duplicated here).

## Redis

### One Redis, three consumers

`backend/src/config/redis.js` exposes a single `getRedisConnection()`
singleton that three subsystems all share:

1. **BullMQ send queue** (`backend/src/queues/whatsappSendQueue.js` /
   `whatsappSendWorker.js`) — the broadcast-message job queue.
2. **Rate limiter** (`rate-limit-redis`, wired in `backend/src/app.js`'s
   middleware chain) — sliding-window counters keyed by `req.ip` or user
   ID.
3. **Socket.IO Redis adapter** (`@socket.io/redis-adapter`, in
   `backend/src/socket.js`) — pub/sub so `emit()` on one API instance
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

The app connects via `mongoose.connect(mongoURI, { autoIndex:
!isProduction })` in `backend/src/config/mongo.js` and otherwise relies on
Mongoose/the MongoDB Node driver's defaults (`maxPoolSize: 100` as of
driver 4+, no explicit override in this codebase). At real concurrency,
size `maxPoolSize` deliberately rather than leaving it implicit — a pool
that's too small serializes requests behind pool-checkout waits; too large
just wastes connections your Mongo tier has to hold open. If you add an
explicit override, do it in `connectDB()`'s `mongoose.connect(...)` call
site (add `maxPoolSize: N` alongside `autoIndex`), and size it relative to
`(API replicas + worker replicas) × maxPoolSize ≤ your Mongo tier's
connection limit`.

### `autoIndex` is disabled in production — on purpose

```js
// autoIndex (and Mongo's own implicit collection creation on first write)
// handles index/collection creation per-model, lazily, as each model is
// actually used — which is what we want here. We deliberately do NOT call
// mongoose.connection.syncIndexes() at boot: that eagerly force-creates a
// real collection for every single registered model across the whole app
// (~30 models between the two merged products), which on a shared/free
// Atlas tier can hit the cluster-wide 500-collection cap and crash-loop
// the server on startup — even for models nothing has written to yet.
await mongoose.connect(mongoURI, {
  autoIndex: !isProduction,
});
```

In development, Mongoose creates indexes lazily as each model's collection
gets its first write — convenient, but in production this same laziness
means **a fresh production database has none of its indexes until each
collection happens to get written to**, and even then, index *build* still
happens implicitly and can be slow/blocking on a collection that already
has data in it (e.g., after a restore).

What operators need to do instead: run index creation **explicitly**, as
a deploy step, not implicitly at request time. Two ways to do this,
depending on what you have available:

1. **A one-off migration script** — write a small script (following the
   pattern of `backend/scripts/migrate-whatsapp-account-uniqueness.js` or
   `backend/bulk/scripts/migrateMetabspUsers.js`, both already in this
   repo) that requires each Mongoose model and calls
   `Model.createIndexes()` (or `Model.syncIndexes()` if you want it to
   also *drop* indexes no longer defined in the schema — be careful with
   that on a live collection with a lot of data, since dropping/rebuilding
   an index can be a long blocking operation). Run it once after each
   deploy that changes schema/index definitions, against the target
   environment's real `MONGO_URI`.
2. **Run it manually via `mongosh`/Atlas's index UI** for a one-time setup
   on a brand-new environment, if you'd rather not script it.

Either way, do this **before** the app receives production traffic on a
fresh database/collection — a collection with data but no index will
still serve correct results, just via full collection scans, until the
index build finishes.

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
`backend/scripts/backup-mongo.sh`/`restore-mongo.sh`,
`ENABLE_SCHEDULED_BACKUPS`, and `backend/scripts/verify-restore.js`'s
restore-drill checks. Not duplicated here; see
[DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) for how that fits into an
RTO/RPO runbook.
