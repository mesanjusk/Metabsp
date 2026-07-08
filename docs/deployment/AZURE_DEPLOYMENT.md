# Azure Deployment

A realistic path for running Metabsp on Azure. See
[PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md) for the topology
this maps onto, and [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) for the
equivalent AWS shape if you're comparing options.

## Compute: Azure Container Apps (or App Service)

Push the existing images to Azure Container Registry:

```bash
az acr build --registry <registry> -f backend/Dockerfile  -t metabsp-backend:$(git rev-parse --short HEAD) .
az acr build --registry <registry> -f frontend/Dockerfile \
  --build-arg VITE_API_SERVER=https://api.yourdomain.com \
  --build-arg VITE_API_URL=https://api.yourdomain.com/api/bulk \
  --build-arg VITE_SOCKET_URL=https://api.yourdomain.com \
  -t metabsp-frontend:$(git rev-parse --short HEAD) .
```

Both builds must run with the **repo root** as build context (npm
workspaces) — `az acr build` takes the context path as its final argument,
so run it from the repo root, not from `backend/`/`frontend/`.

- **Container Apps** is the better default for this app: it gives you
  HTTP-based autoscaling, revisions, and Dapr-free simplicity without
  managing a Kubernetes control plane. Run the API as one Container App
  (target port 5000, ingress enabled) and, optionally, the standalone
  worker as a second Container App from the same image with the command
  overridden to `npm run worker --workspace=backend` and **no ingress** —
  it doesn't serve HTTP traffic (mirrors the `worker` service in
  `docker-compose.yml` under the `scale-workers` profile).
- **App Service (Web App for Containers)** works too if you'd rather stay
  on a more traditional PaaS model; it's a reasonable choice if the rest of
  your org already standardizes on App Service, but Container Apps' native
  revision/scale-rule model fits this app's API/worker split more directly.
- Set the health probe (Container Apps: liveness/readiness probe; App
  Service: health check path) to `GET /health` — see `backend/src/app.js`,
  which returns `503` if Mongo isn't connected, so a bad DB connection
  actually removes the instance from rotation.

## Database: Cosmos DB (Mongo API) or a Mongo VM/Atlas

**Cosmos DB's MongoDB API** is the "native Azure" option, but like
DocumentDB on AWS it's a compatibility layer, not real MongoDB — verify
Mongoose 8.5's aggregation/index usage against it before committing, since
this codebase has only been developed/tested against real MongoDB
(including via `mongodb-memory-server` in the test suite).

**MongoDB Atlas on Azure** is the safer default for behavioral parity with
what this app was built against — deploy it in the same Azure region as
your Container Apps environment and use Atlas's Azure Private Link rather
than a public connection string.

Whichever you choose, read
[REDIS_AND_MONGODB_OPS.md](./REDIS_AND_MONGODB_OPS.md) for why
`backend/src/config/mongo.js` disables `autoIndex` in production
(`autoIndex: !isProduction`) and what that means you need to do explicitly
(run index creation yourself, e.g. via a migration script) rather than
relying on Mongoose to create indexes/collections lazily at request time.

## Redis: Azure Cache for Redis

A **Basic/Standard** tier tracks `REDIS_URL` in `backend/src/config/redis.js`
directly — good enough for a v1. Once you need multi-shard throughput or
want to avoid a single Redis node's write ceiling, move to the **Premium
tier's clustering** support and set `REDIS_CLUSTER_NODES` (comma-separated
`host:port` shard endpoints) instead of `REDIS_URL` — no code change
required, `getRedisConnection()` picks cluster mode automatically when that
var is set. See
[REDIS_AND_MONGODB_OPS.md](./REDIS_AND_MONGODB_OPS.md) for what shares this
Redis instance (BullMQ send queue, the `rate-limit-redis` store, and the
Socket.IO `@socket.io/redis-adapter` pub/sub) and why that affects sizing.

## Backup storage: Azure Blob Storage

`docs/BACKUP_RESTORE.md` covers the actual backup mechanics
(`backend/scripts/backup-mongo.sh`, `mongodump`/`mongorestore`,
`ENABLE_SCHEDULED_BACKUPS`/`BACKUP_DIR`). On Azure: run the backup from an
Azure Container Apps Job (or an Automation Account runbook) on a schedule,
writing to a mounted path that then uploads to Blob Storage (`az storage
blob upload-batch`), or mount Blob Storage directly via Blobfuse if you'd
rather write there in one step. Apply lifecycle management policies to
match the doc's suggested retention (14 days daily, 90 days weekly), and
keep the container's access tier and delete-lock settings such that a
compromised app identity can't wipe backup history.

## Frontend: Azure Front Door + Static Web Apps (or Blob + CDN)

**Azure Static Web Apps** is the lowest-friction option: point it at
`frontend/dist` (built with the real `VITE_API_SERVER`/`VITE_API_URL`/
`VITE_SOCKET_URL` values) and it handles the SPA fallback rewrite natively
— equivalent to the `try_files $uri $uri/ /index.html` rule in
`frontend/nginx.conf`. If you need more control over routing/caching rules
or want the frontend integrated into a broader Front Door setup, use Blob
Storage static website hosting behind Azure Front Door instead, with an
explicit fallback rule for unmatched paths.

## Front Door/App Gateway, TLS, and TRUST_PROXY

Terminate TLS at Azure Front Door (recommended — it's also your CDN/WAF
layer) or Application Gateway, then route to the Container Apps ingress.
That's **one hop** in front of the Node process in the common single-proxy
case, so set `TRUST_PROXY=1` — matching the default in
`backend/.env.example` and what `backend/src/app.js` expects. Note Container
Apps' own ingress layer may itself add a hop before your traffic reaches the
container; check whether `X-Forwarded-For` already has your edge's IP
appended once by the platform, and adjust the hop count accordingly rather
than assuming 1 blindly. Getting this wrong affects the Redis-backed rate
limiter (`rate-limit-redis`), which keys unauthenticated routes by `req.ip`
— see [NGINX_SSL_CLOUDFLARE.md](./NGINX_SSL_CLOUDFLARE.md) for the general
reasoning behind hop counts if you add another proxy layer (e.g.
Cloudflare) in front of Azure.

## Secrets: Azure Key Vault

Store every non-default var from `backend/.env.example`
(`JWT_SECRET`, `WHATSAPP_TOKEN_ENCRYPTION_KEY`, `META_APP_SECRET`,
`META_API_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `CLOUDINARY_API_SECRET`,
`CASHFREE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `SENTRY_DSN`, `MONGO_URI`,
`REDIS_URL`) in Key Vault and reference them from the Container App's
secret bindings (Container Apps supports referencing Key Vault secrets
directly via managed identity — no plaintext env vars in the revision
spec). Per `docs/BACKUP_RESTORE.md`, back up `WHATSAPP_TOKEN_ENCRYPTION_KEY`
and `JWT_SECRET` in Key Vault's own versioning/soft-delete, separate from
any Mongo snapshot — a restored database is useless without them. Use
`WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS` (see `backend/src/utils/crypto.js`)
during rotation so it's a no-downtime operation.

## Next steps

- [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md) if you'd rather
  run this on AKS instead of Container Apps.
- [MONITORING.md](./MONITORING.md) — Container Apps' built-in Log Analytics
  sink is the natural place to ship the app's pino stdout logs.
- [SCALING.md](./SCALING.md) and
  [HIGH_AVAILABILITY.md](./HIGH_AVAILABILITY.md) before scaling the API
  app's replica count above 1.
