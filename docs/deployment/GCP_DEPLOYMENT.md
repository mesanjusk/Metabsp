# GCP Deployment

A realistic path for running Metabsp on Google Cloud. See
[PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md) for the topology
this maps onto, and [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md)/
[AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md) for the equivalent shapes
elsewhere.

## Compute: Cloud Run (or GKE)

Build and push the existing images with Cloud Build, from the repo root
(both Dockerfiles need the monorepo root as build context for npm
workspaces):

```bash
gcloud builds submit --config - . <<'EOF'
steps:
  - name: gcr.io/cloud-builders/docker
    args: [build, -f, backend/Dockerfile, -t, gcr.io/$PROJECT_ID/metabsp-backend, .]
images: [gcr.io/$PROJECT_ID/metabsp-backend]
EOF
```

- **Cloud Run** is the natural fit here: the API is a stateless HTTP
  process listening on `PORT` (which Cloud Run injects — `backend/src/
  index.js` already reads `process.env.PORT || 5000`, so no change
  needed), and Cloud Run's request-based autoscaling matches the app's
  request-response model. One caveat: Cloud Run scales to zero by default,
  which would drop long-lived Socket.IO connections and in-process BullMQ
  workers between requests — set a minimum instance count > 0 for the API
  service if real-time chat and in-process broadcast sending need to stay
  warm.
- **Standalone worker**: deploy a second Cloud Run service from the same
  image with the container command overridden to
  `npm run worker --workspace=backend`, **no ingress**, and minimum
  instances set to at least 1 (a worker with zero instances processes zero
  queued jobs) — mirrors the `worker` service in `docker-compose.yml`'s
  `scale-workers` profile. Cloud Run Jobs is the wrong primitive here since
  the worker is a long-running consumer, not a run-to-completion task.
- **GKE** is the better choice once you want the workers to actually run as
  long-lived pods without minimum-instance workarounds, or you want
  StatefulSets for self-hosted Redis/Mongo — see
  [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md).
- Health check: `GET /health` (see `backend/src/app.js`) for both the Cloud
  Run service's startup/liveness probe and any external uptime check —
  returns `503` when Mongo is disconnected.

## Database: MongoDB Atlas (GCP-hosted)

GCP has no native managed MongoDB-compatible offering (unlike AWS
DocumentDB or Azure Cosmos DB) — **MongoDB Atlas on GCP** is the standard
answer, and it's also the option with the least behavioral risk since this
app is developed and tested against real MongoDB. Deploy the Atlas cluster
in the same GCP region as your Cloud Run/GKE workloads and use Atlas's GCP
Private Service Connect rather than a public connection string.

Set `MONGO_URI` via Secret Manager (below), and read
[REDIS_AND_MONGODB_OPS.md](./REDIS_AND_MONGODB_OPS.md) for why
`backend/src/config/mongo.js` sets `autoIndex: !isProduction` — production
deliberately skips Mongoose's lazy index/collection creation (to avoid
tripping Atlas's cluster-wide collection cap across ~30 models), so you
need to run index creation explicitly, e.g. via a migration script, as part
of your deploy process.

## Redis: Memorystore

**Memorystore for Redis** (Basic tier) is the default: point `REDIS_URL` at
its endpoint, matching `backend/src/config/redis.js`'s single-instance
path. Once you need cluster-level throughput or want to shard past a
single node, use **Memorystore for Redis Cluster** and set
`REDIS_CLUSTER_NODES` (comma-separated `host:port` shard endpoints) instead
— `getRedisConnection()` switches to `IORedis.Cluster` automatically when
that var is present, no code change. See
[REDIS_AND_MONGODB_OPS.md](./REDIS_AND_MONGODB_OPS.md) for what this Redis
instance actually serves (BullMQ send queue, the `rate-limit-redis` store,
the Socket.IO `@socket.io/redis-adapter` pub/sub) and why that shapes
sizing. Note Memorystore instances are VPC-internal — if you're on Cloud
Run, you'll need a Serverless VPC Access connector to reach it.

## Backup storage: Cloud Storage

`docs/BACKUP_RESTORE.md` covers the mechanics
(`backend/scripts/backup-mongo.sh`, `mongodump`/`mongorestore`,
`ENABLE_SCHEDULED_BACKUPS`/`BACKUP_DIR`). On GCP: run the backup as a Cloud
Run Job (or a Cloud Scheduler-triggered Cloud Function/Run job) on a
schedule, writing to a mounted path and then `gsutil cp`/`gcloud storage
cp` to a Cloud Storage bucket, or mount Cloud Storage via Cloud Storage
FUSE if you want a single write step. Apply Object Lifecycle Management
rules matching the doc's suggested retention (14 days daily, 90 days
weekly), and enable Bucket Lock/retention policies so backups can't be
deleted by a compromised app service account.

## Frontend: Cloud CDN + Cloud Storage (or Firebase Hosting)

Upload `frontend/dist` (built with real `VITE_API_SERVER`/`VITE_API_URL`/
`VITE_SOCKET_URL` build args) to a Cloud Storage bucket configured for
static website hosting, front it with Cloud CDN + a global external HTTPS
load balancer, and configure the "not found" page to serve `index.html`
with a 200 to replicate the SPA fallback (`try_files $uri $uri/
/index.html`) that `frontend/nginx.conf` does in the container path.
**Firebase Hosting** is the lower-config alternative — it handles the SPA
rewrite and CDN/TLS out of the box with a single `firebase deploy`, and is
worth it if you don't already have GCP load balancer infrastructure to
reuse.

## Load balancer, TLS, and TRUST_PROXY

If you're on Cloud Run, Google terminates TLS and fronts the service with
its own infrastructure automatically — Cloud Run sets `X-Forwarded-*`
headers itself, so treat that as the one hop and set `TRUST_PROXY=1`
(matching the default in `backend/.env.example`), unless you additionally
put a global external HTTPS load balancer or Cloud CDN in front of Cloud
Run, in which case that's an additional hop and `TRUST_PROXY` should
reflect the real count. This matters beyond correct IP logging: the
Redis-backed rate limiter (`rate-limit-redis` in `backend/src/app.js`'s
dependency chain) keys unauthenticated routes by `req.ip`, so a
misconfigured hop count either buckets every user under one shared IP or
opens the door to `X-Forwarded-For` spoofing. See
[NGINX_SSL_CLOUDFLARE.md](./NGINX_SSL_CLOUDFLARE.md) for the same reasoning
applied to a self-managed nginx layer, e.g. if GKE Ingress uses nginx-ingress
instead of GCE's native load balancer.

## Secrets: Secret Manager

Store every non-default var from `backend/.env.example`
(`JWT_SECRET`, `WHATSAPP_TOKEN_ENCRYPTION_KEY`, `META_APP_SECRET`,
`META_API_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `CLOUDINARY_API_SECRET`,
`CASHFREE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `SENTRY_DSN`, `MONGO_URI`,
`REDIS_URL`) in Secret Manager and mount them into Cloud Run/GKE via the
native Secret Manager integration (Cloud Run: `--set-secrets`; GKE: the
Secret Manager CSI driver or External Secrets Operator), rather than plain
environment variables in the service spec. Per `docs/BACKUP_RESTORE.md`,
version `WHATSAPP_TOKEN_ENCRYPTION_KEY` and `JWT_SECRET` in Secret
Manager independently of any Mongo snapshot — a restore is only as good as
those keys. Use `WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS` (see
`backend/src/utils/crypto.js`) during rotation to avoid a downtime window.

## Next steps

- [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md) for the GKE path.
- [MONITORING.md](./MONITORING.md) — Cloud Run/GKE both ship container
  stdout to Cloud Logging automatically, which is where this app's pino
  JSON logs land without extra wiring.
- [SCALING.md](./SCALING.md) and
  [HIGH_AVAILABILITY.md](./HIGH_AVAILABILITY.md) before raising the API
  service's max instance count or min-instances above 1.
