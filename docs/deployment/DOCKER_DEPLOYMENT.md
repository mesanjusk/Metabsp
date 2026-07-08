# Docker Deployment (single host)

The repo's root `docker-compose.yml` is a **development** compose file —
its own comments say as much (`Dev-only placeholder secrets`). This guide
covers what to actually change to run it as a real single-host production
deployment, and when you'd outgrow a single host entirely (see
[KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md) and the cloud guides
for that).

## What the dev compose file gives you

```yaml
services:
  mongo:     # mongo:7, no auth, host port 27017 exposed
  redis:     # redis:7-alpine, no auth, host port 6379 exposed
  backend:   # backend/Dockerfile, NODE_ENV=development, placeholder secrets
  worker:    # optional — profiles: ["scale-workers"], same image, `npm run worker`
  frontend:  # frontend/Dockerfile, nginx serving the built SPA
```

Four things in there are explicitly dev-only and must change for
production, in order of how bad it is to leave them:

1. **`JWT_SECRET: dev-only-change-me`** and
   **`WHATSAPP_TOKEN_ENCRYPTION_KEY: ZGV2LW9ubHktMzItYnl0ZS1rZXktY2hhbmdlLW1lITE=`**
   — these are checked into the compose file in plaintext. Generate real
   values (`openssl rand -base64 32` for the encryption key — it must
   decode to exactly 32 bytes per `backend/src/utils/crypto.js`) and inject
   them via a `.env` file (compose reads `.env` next to the compose file
   automatically) or `docker compose --env-file`, never committed to git.
2. **`mongo`/`redis` ports exposed to the host** (`27017:27017`,
   `6379:6379`) — fine for local development, a real security exposure on
   a production host with a public IP. Drop the `ports:` mappings for both
   services in production; the `backend`/`worker` services reach them over
   the compose-internal network by service name (`mongo`, `redis`) without
   needing the host port published at all.
3. **`NODE_ENV: development`** on `backend` and `worker` — set this to
   `production`. This isn't cosmetic: `backend/src/config/mongo.js` checks
   `NODE_ENV === 'production'` to decide whether to run Mongoose's
   `autoIndex` (see [REDIS_AND_MONGODB_OPS.md](./REDIS_AND_MONGODB_OPS.md)
   for why that matters), and `backend/src/utils/logger.js` defaults
   `LOG_LEVEL` to `info` instead of `debug` in production.
4. **No restart-policy tuning or resource limits** — `restart:
   unless-stopped` is already set on every service, which is a reasonable
   default (survives host reboots and crashes, doesn't fight you during
   `docker compose down`). Add resource limits so one runaway container
   (e.g. a Baileys session leak, a large aggregation query) can't starve
   the host:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
        reservations:
          memory: 512M
```

(`deploy.resources` is honored by plain `docker compose` on modern Compose
versions, not just Swarm — verify with `docker compose version` if limits
don't seem to apply.)

## A production overlay file

Rather than hand-editing `docker-compose.yml`, layer a
`docker-compose.prod.yml` on top and run both:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

```yaml
# docker-compose.prod.yml
services:
  mongo:
    ports: !reset []          # stop publishing 27017 to the host
    volumes:
      - mongo_data:/data/db
    deploy:
      resources: { limits: { memory: 2G } }

  redis:
    ports: !reset []           # stop publishing 6379 to the host
    deploy:
      resources: { limits: { memory: 512M } }

  backend:
    environment:
      NODE_ENV: production
      # JWT_SECRET / WHATSAPP_TOKEN_ENCRYPTION_KEY / MONGO_URI / REDIS_URL /
      # META_APP_SECRET etc. come from a real .env file or the host's
      # secret store — do not inline them here.
    env_file: .env.production
    deploy:
      resources: { limits: { cpus: "1.0", memory: 1G } }

  worker:
    env_file: .env.production
    deploy:
      resources: { limits: { cpus: "0.5", memory: 512M } }

  frontend:
    build:
      args:
        VITE_API_SERVER: https://api.yourdomain.com
        VITE_API_URL: https://api.yourdomain.com/api/bulk
        VITE_SOCKET_URL: https://api.yourdomain.com
```

(`!reset []` requires Compose Specification v2.24+; if your Compose version
predates that, just omit the `ports:` key entirely for `mongo`/`redis` in a
non-merged production-only compose file instead of trying to override it.)

## The `worker` service and `scale-workers` profile

`docker-compose.yml` already models the standalone broadcast-send worker
(`backend/src/worker.js`) as an opt-in service:

```bash
docker compose --profile scale-workers up -d worker
```

It's not started by a plain `docker compose up` — the API's in-process
worker (`startWhatsAppSendWorker()` in `backend/src/index.js`) handles
broadcast sends by default. Bring up the
standalone `worker` service instead once send volume needs to scale
independently of API request capacity, and scale it with `docker compose
--profile scale-workers up -d --scale worker=3 worker` — BullMQ's job
locking makes multiple concurrent worker containers safe (see
`backend/src/queues/whatsappSendWorker.js`). If you do run the standalone
worker service, there's no code switch to stop the API's in-process worker
from also running — both would then be consuming the same queue, which is
harmless (BullMQ dedupes job delivery), just extra idle capacity on the API
side. See [SCALING.md](./SCALING.md) for when that split is actually worth
making.

## Behind a reverse proxy

A single-host deployment almost always wants nginx or Caddy in front of
both the `backend` and `frontend` containers for TLS termination — see
[NGINX_SSL_CLOUDFLARE.md](./NGINX_SSL_CLOUDFLARE.md) for a concrete config,
including the `TRUST_PROXY` value nginx-in-front requires.

## Backups on a single host

Run `backend/scripts/backup-mongo.sh` from the host's cron (not from
inside the `mongo` container, which has no durable place to write
archives) pointed at the same `MONGO_URI` the `backend` service uses, and
copy the resulting archive off-host per `docs/BACKUP_RESTORE.md`'s
guidance — a backup living on the same disk as `mongo_data` protects
against nothing.

## Next steps

- [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md) once one host
  stops being enough (no failover if the host dies, no rolling deploys).
- [MONITORING.md](./MONITORING.md) for shipping the containers' stdout
  logs off the host.
