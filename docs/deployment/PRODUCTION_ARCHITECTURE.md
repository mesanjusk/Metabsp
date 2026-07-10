# Production Architecture

This describes the actual runtime topology of Metabsp (the merged Meta
WhatsApp Cloud API BSP + legacy Baileys/WhatsApp-Web "Bulk Invite" product),
not a generic Node.js reference architecture. See `backend/src/app.js`,
`backend/src/index.js`, `backend/src/socket.js`, and
`backend/src/config/redis.js` for the code this is grounded in.

## Diagram

```
                         ┌───────────────────────────┐
                         │        Frontend           │
                         │  Vite/React SPA (nginx    │
                         │  or CDN static hosting)   │
                         │  build args bake in:      │
                         │  VITE_API_SERVER          │
                         │  VITE_API_URL             │
                         │  VITE_SOCKET_URL          │
                         └────────────┬──────────────┘
                                      │ HTTPS (REST + Socket.IO)
                                      ▼
                         ┌───────────────────────────┐
                         │   Load balancer / reverse │
                         │   proxy (ALB / nginx /    │
                         │   Cloudflare) — TLS       │
                         │   termination             │
                         └────────────┬──────────────┘
                                      │
                 ┌────────────────────┼────────────────────┐
                 ▼                    ▼                    ▼
        ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
        │ API instance 1 │   │ API instance 2 │   │ API instance N │
        │ (backend/      │   │ (backend/      │   │ (backend/      │
        │  Dockerfile,   │   │  Dockerfile)   │   │  Dockerfile)   │
        │  node src/     │   │                │   │                │
        │  index.js)     │   │                │   │                │
        │ - Express API  │   │                │   │                │
        │ - Socket.IO    │   │                │   │                │
        │ - in-process   │   │                │   │                │
        │   send worker* │   │                │   │                │
        └───────┬────────┘   └───────┬────────┘   └───────┬────────┘
                │                    │                     │
                └────────────┬───────┴──────────┬──────────┘
                              ▼                  ▼
                    ┌──────────────────┐  ┌──────────────────┐
                    │      Redis       │  │     MongoDB       │
                    │ (single instance │  │ (single instance  │
                    │  or Cluster via  │  │  or replica set)  │
                    │  REDIS_CLUSTER_  │  │                   │
                    │  NODES)          │  │                   │
                    │ - BullMQ queue   │  │ System of record: │
                    │ - rate limiter   │  │ accounts,         │
                    │ - Socket.IO      │  │ messages,         │
                    │   pub/sub adapter│  │ contacts, rules,  │
                    └──────────────────┘  │ billing, audit    │
                                          └──────────────────┘
                              ▲
                              │ (shared connection, same Redis)
                    ┌──────────────────────┐
                    │ Standalone worker(s) │  optional, opt-in:
                    │ backend/src/worker.js│  `npm run worker`
                    │ (backend/Dockerfile, │  docker-compose
                    │  command override)  │  `scale-workers` profile
                    └──────────────────────┘

* Only runs in-process when the standalone worker isn't deployed — see
  "Two ways to run the send worker" below.
```

## Components

**API server(s)** — `backend/src/index.js` boots one process that serves
the Express app (`backend/src/app.js`), a Socket.IO server
(`backend/src/socket.js`), and (by default) the BullMQ broadcast-send worker
in-process. Stateless with respect to HTTP: every request is independently
authenticated via JWT, so any instance can serve any request. Horizontally
scalable — see [SCALING.md](./SCALING.md) — but see the caveats in
[HIGH_AVAILABILITY.md](./HIGH_AVAILABILITY.md) about in-process schedulers
and Baileys sessions before running N replicas blindly.

**Standalone worker (optional)** — `backend/src/worker.js`, run via
`npm run worker --workspace=backend`. Processes the same BullMQ queue
(`backend/src/queues/whatsappSendWorker.js`) against the same Mongo/Redis as
the API. This is a deployment-topology choice, not a code fork: you either
let the API do it in-process (default, fine at low-to-moderate scale) or
extract it as its own process/replica set once broadcast-send volume needs
to scale independently of API request capacity, or so an API crash doesn't
also kill in-flight sends. `docker-compose.yml` models this as a `worker`
service behind the `scale-workers` profile.

**MongoDB** — the only real datastore (Redis is intentionally not
backed up — see `docs/BACKUP_RESTORE.md`). Stateful, singleton in the
sense that it needs a real replica set / managed HA tier to not be a single
point of failure; the app itself does not shard or fan out writes.

**Redis** — shared by three subsystems that all read `getRedisConnection()`
from `backend/src/config/redis.js`: the BullMQ send queue, the
`express-rate-limit` + `rate-limit-redis` store, and the Socket.IO
`@socket.io/redis-adapter` pub/sub. Single instance by default
(`REDIS_URL`); set `REDIS_CLUSTER_NODES` (comma-separated `host:port`) to
run against a Redis Cluster instead — every consumer uses whatever
`getRedisConnection()` returns without caring which mode it's in. See
[REDIS_AND_MONGODB_OPS.md](./REDIS_AND_MONGODB_OPS.md).

**Socket.IO + Redis adapter** — without the adapter, each API instance
keeps its own in-memory socket registry, so an `emit()` on instance A never
reaches a client connected to instance B. The adapter fixes that by
broadcasting through the shared Redis, which is what makes running more
than one API instance behind a load balancer actually work for real-time
chat/notifications, not just REST traffic.

**Frontend** — a single Vite/React SPA (`frontend/`) built once per
target domain, since `VITE_API_SERVER`/`VITE_API_URL`/`VITE_SOCKET_URL` are
baked in at build time (see `frontend/Dockerfile`'s `ARG`s). The CORS
allow-list in `backend/src/app.js` (`allowedOrigins`) already reflects
multiple such builds deployed to different domains (Vercel previews,
`bulk.instify.in`, `meta.instify.in`, etc.) all talking to the same backend
— that's the "two frontend build outputs" pattern in practice: one codebase,
built twice (or more) with different API origins baked in, not two separate
frontend apps.

**Optional pieces** — Sentry (`backend/src/instrument.js`, inert unless
`SENTRY_DSN` is set), scheduled backups
(`ENABLE_SCHEDULED_BACKUPS`/`BACKUP_DIR`, see `docs/BACKUP_RESTORE.md`), and
the Swagger UI at `/api-docs`.

## Singleton/stateful vs. horizontally scalable

| Component | Stateful/singleton? | Scales horizontally? |
|---|---|---|
| MongoDB | Yes — needs a real replica set for HA | Read replicas/sharding only at real scale (see `REDIS_AND_MONGODB_OPS.md`) |
| Redis | Yes by default (single instance) | Yes, via `REDIS_CLUSTER_NODES` |
| API instances | No (HTTP is stateless; JWT-based auth) | Yes, given the Socket.IO Redis adapter — but see HA caveats on schedulers/Baileys |
| Standalone worker | No — BullMQ handles concurrent consumers safely | Yes |
| Frontend static build | N/A (static assets) | Trivially, via CDN |

For the full honest picture of what isn't yet safely multi-instance today
(in-process schedulers, Baileys sessions), see
[HIGH_AVAILABILITY.md](./HIGH_AVAILABILITY.md) and
[SCALING.md](./SCALING.md).
