# AWS Deployment

A realistic path for running Metabsp on AWS. See
[PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md) for the topology
this maps onto.

## Compute: ECS Fargate (or EC2)

Build the existing images as-is and push to ECR:

```bash
docker build -f backend/Dockerfile  -t <acct>.dkr.ecr.<region>.amazonaws.com/metabsp-backend:$(git rev-parse --short HEAD)  .
docker build -f frontend/Dockerfile \
  --build-arg VITE_API_SERVER=https://api.yourdomain.com \
  --build-arg VITE_API_URL=https://api.yourdomain.com/api/bulk \
  --build-arg VITE_SOCKET_URL=https://api.yourdomain.com \
  -t <acct>.dkr.ecr.<region>.amazonaws.com/metabsp-frontend:$(git rev-parse --short HEAD) .
```

Note both Dockerfiles require the **repo root** as build context (npm
workspaces), not `backend/`/`frontend/` — see the comment at the top of
each Dockerfile.

- **API service**: an ECS Fargate service running the `metabsp-backend`
  image, `CMD ["node", "src/index.js"]` (unchanged), container port 5000.
  Fargate is the lower-ops choice for a v1; EC2-backed ECS (or plain EC2 +
  an ASG) is worth it once you have enough steady-state load to make
  reserved/spot pricing pay off.
- **Worker service (optional)**: a second ECS service from the *same*
  image, overriding the container command to
  `["npm", "run", "worker", "--workspace=backend"]` (mirrors
  `docker-compose.yml`'s `worker` service under the `scale-workers`
  profile). Scale this service's desired count independently of the API
  service's — see `backend/src/worker.js`'s own comment on why you'd split
  it out.
- **Frontend**: the `metabsp-frontend` image is just nginx serving a static
  build — CloudFront + S3 (below) is usually simpler and cheaper than
  running it as a container, but if you want one deployment pipeline for
  everything, ECS Fargate works fine here too.

Health check target: `GET /health` (see `backend/src/app.js`) — returns
`200` with `{ ok: true, db: 'connected', ... }` when Mongo is up, `503`
otherwise. Wire this as both the ALB target group health check and the ECS
container health check so a lost Mongo connection actually pulls the task
out of rotation instead of just failing requests silently.

## Database: MongoDB Atlas or DocumentDB

**MongoDB Atlas** (recommended) — this app is developed and tested against
real MongoDB (Mongoose 8.5, `mongodb-memory-server` in tests), so Atlas is
the path with the least behavioral risk. Deploy Atlas on AWS in the same
region as your ECS cluster to keep latency down; use Atlas's built-in
VPC peering/PrivateLink rather than a public connection string.

**Amazon DocumentDB** is Mongo-*API-compatible*, not a real MongoDB build —
if you go this route, validate the app's actual driver features against it
before committing (aggregation pipeline operators, change streams if ever
added, index behavior) since compatibility gaps are the standard risk with
DocumentDB. This repo hasn't been verified against DocumentDB.

Either way: set `MONGO_URI` in Secrets Manager (below), and read
[REDIS_AND_MONGODB_OPS.md](./REDIS_AND_MONGODB_OPS.md) for the
`autoIndex: !isProduction` behavior in `backend/src/config/mongo.js` —
you'll need to run index creation explicitly against whichever Mongo you
pick, since production intentionally skips auto-index/collection creation.

## Redis: ElastiCache

Use ElastiCache for Redis (or Valkey). For a v1, a single-node/primary-replica
setup mapped to `REDIS_URL` is enough — that's what
`backend/src/config/redis.js` uses by default. Once you outgrow a single
node's throughput or want multi-AZ write availability, switch to
**ElastiCache in cluster mode** and set `REDIS_CLUSTER_NODES` to the cluster's
shard endpoints (comma-separated `host:port`) instead of `REDIS_URL` — the
app doesn't need code changes for this, `getRedisConnection()` already
branches on whichever env var is set. See
[REDIS_AND_MONGODB_OPS.md](./REDIS_AND_MONGODB_OPS.md) for what shares this
Redis (BullMQ queue, rate limiter, Socket.IO adapter) and why that matters
for sizing.

## Backup storage: S3

`docs/BACKUP_RESTORE.md` already describes the backup mechanics
(`backend/scripts/backup-mongo.sh`, `mongodump`/`mongorestore`,
`ENABLE_SCHEDULED_BACKUPS`). On AWS: point `BACKUP_DIR` at an EBS/EFS mount
that a scheduled task then syncs to S3 (`aws s3 sync`), or run the backup
itself from an ECS scheduled task (EventBridge Scheduler + ECS RunTask)
that writes directly to an S3-mounted path — either way, per that doc's own
guidance, store archives off the database host. Use S3 lifecycle rules to
match the suggested retention (14 days daily, 90 days weekly) and enable
versioning + a bucket policy that denies delete for anything but a
break-glass role.

## Frontend: CloudFront + S3 (or Amplify)

Upload `frontend/dist` (built with the real production `VITE_API_SERVER`/
`VITE_API_URL`/`VITE_SOCKET_URL` build args) to an S3 bucket, front it with
CloudFront, and set a custom error response (403/404 → `/index.html`, 200)
to replicate the SPA fallback that `frontend/nginx.conf`'s
`try_files $uri $uri/ /index.html` does in the container path. AWS
Amplify Hosting is the lower-config alternative if you want built-in CI
from a git push instead of your own S3/CloudFront pipeline.

## ALB, TLS, and TRUST_PROXY

Put an Application Load Balancer in front of the API service with an ACM
certificate for TLS termination. The ALB is **one hop** in front of the
Node process, so set `TRUST_PROXY=1` in the API's environment — that
matches the default in `backend/.env.example` and is what
`backend/src/app.js` expects (a hop count, or `true`/`false`). Getting this
wrong doesn't just mis-log IPs: the Redis-backed rate limiter
(`rate-limit-redis`) keys unauthenticated routes by `req.ip`, so an
incorrect trust-proxy setting would either see every request as coming
from the ALB's IP (one shared rate-limit bucket for all users) or, if you
set it too high, allow IP spoofing via `X-Forwarded-For`. If you add
CloudFront in front of the ALB too, that's two hops and `TRUST_PROXY`
should be `2`. See [NGINX_SSL_CLOUDFLARE.md](./NGINX_SSL_CLOUDFLARE.md) for
the equivalent nginx-hop-count reasoning if you self-host the proxy layer
instead.

## Secrets: AWS Secrets Manager

Put every var from `backend/.env.example` that isn't a public default
(`JWT_SECRET`, `WHATSAPP_TOKEN_ENCRYPTION_KEY`, `META_APP_SECRET`,
`META_API_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `CLOUDINARY_API_SECRET`,
`CASHFREE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `SENTRY_DSN`, `MONGO_URI`,
`REDIS_URL`) into Secrets Manager and inject them into the ECS task
definition as `secrets` (not plain `environment` vars). Per
`docs/BACKUP_RESTORE.md`, keep `WHATSAPP_TOKEN_ENCRYPTION_KEY` and
`JWT_SECRET` backed up/versioned in Secrets Manager independently of any
Mongo snapshot — a restored database is useless without them. Rotate
`WHATSAPP_TOKEN_ENCRYPTION_KEY` using the
`WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS` fallback described in
`backend/src/utils/crypto.js` and `.env.example`, so a key rotation doesn't
require a maintenance window.

## Next steps

- [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md) if you'd rather
  run this on EKS instead of ECS.
- [MONITORING.md](./MONITORING.md) for wiring Sentry + log shipping
  (CloudWatch Logs is the natural stdout sink for ECS tasks).
- [SCALING.md](./SCALING.md) and
  [HIGH_AVAILABILITY.md](./HIGH_AVAILABILITY.md) before setting the API
  service's desired count above 1.
