# Kubernetes Deployment

A realistic manifest/Helm-shaped guide for Metabsp. See
[PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md) for the topology
and [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for the single-host
precursor to this.

## Recommendation for a v1: don't self-host MongoDB/Redis on the cluster

Both `mongo:7` and `redis:7-alpine` in `docker-compose.yml` are trivial to
containerize but non-trivial to run correctly as StatefulSets in
production — replica set election, PodDisruptionBudgets, PVC storage
class/IOPS tuning, backup coordination. Use a managed MongoDB (Atlas —
see the cloud-specific guides) and managed Redis (ElastiCache/Memorystore/
Azure Cache) for a v1, and only bring them in-cluster later if there's a
specific reason (data residency, cost at very large scale) that outweighs
the operational burden. The rest of this guide assumes managed Mongo/Redis
and focuses the cluster on the two things this app's containers actually
are: the API and the worker.

If you do self-host anyway: MongoDB needs a StatefulSet with at least 3
replicas (proper replica set, not a single pod) and a PodDisruptionBudget;
Redis needs either a StatefulSet running Redis Cluster mode (matching
`REDIS_CLUSTER_NODES`) or the Bitnami/official Redis Helm chart's
replication mode. Neither is covered in depth here — this is exactly the
kind of stateful workload Kubernetes makes possible but not easy.

## API Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: metabsp-api
spec:
  replicas: 3
  selector:
    matchLabels: { app: metabsp-api }
  template:
    metadata:
      labels: { app: metabsp-api }
    spec:
      containers:
        - name: api
          image: <registry>/metabsp-backend:<tag>   # built from backend/Dockerfile
          ports:
            - containerPort: 5000
          envFrom:
            - configMapRef: { name: metabsp-config }
            - secretRef: { name: metabsp-secrets }
          readinessProbe:
            httpGet: { path: /health, port: 5000 }
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet: { path: /health, port: 5000 }
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3
          resources:
            requests: { cpu: "250m", memory: "384Mi" }
            limits:   { cpu: "1",    memory: "768Mi" }
```

`GET /health` (see `backend/src/app.js`) returns `200` only when
`mongoose.connection.readyState === 1`, and `503` otherwise — a real
liveness/readiness signal, not just "the process is alive." Before setting
`replicas` above 1, read the caveats in
[HIGH_AVAILABILITY.md](./HIGH_AVAILABILITY.md) about in-process schedulers
and Baileys sessions running once per pod with no leader election.

## Worker Deployment (scales independently)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: metabsp-worker
spec:
  replicas: 2
  selector:
    matchLabels: { app: metabsp-worker }
  template:
    metadata:
      labels: { app: metabsp-worker }
    spec:
      containers:
        - name: worker
          image: <registry>/metabsp-backend:<tag>   # same image as the API
          command: ["node", "src/worker.js"]
          envFrom:
            - configMapRef: { name: metabsp-config }
            - secretRef: { name: metabsp-secrets }
          resources:
            requests: { cpu: "250m", memory: "256Mi" }
            limits:   { cpu: "500m", memory: "512Mi" }
```

No `Service`/ingress for the worker — it doesn't serve HTTP, it only
consumes the BullMQ queue (`backend/src/queues/whatsappSendWorker.js`)
against the same Mongo/Redis the API uses. This is exactly the API/worker
split `backend/src/worker.js`'s own comment describes: run it in-process
(don't deploy this Deployment, let the API's `startWhatsAppSendWorker()`
handle it) at low-to-moderate scale, and split it out — as above — once
send volume needs to scale independently of API request capacity, or so an
API pod crash/restart doesn't interrupt in-flight sends. Scale replicas on
this Deployment alone; BullMQ's per-job locking makes concurrent consumers
across replicas safe.

## Service + Ingress

```yaml
apiVersion: v1
kind: Service
metadata:
  name: metabsp-api
spec:
  selector: { app: metabsp-api }
  ports:
    - port: 80
      targetPort: 5000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: metabsp-api
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"   # matches express.json({ limit: '50mb' })
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts: [api.yourdomain.com]
      secretName: metabsp-api-tls
  rules:
    - host: api.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service: { name: metabsp-api, port: { number: 80 } }
```

`backend/src/app.js` sets `express.json({ limit: '50mb' })` and
`express.urlencoded({ extended: true, limit: '50mb' })` — an ingress
default body-size cap (nginx-ingress defaults to 1m) will reject legitimate
requests before they even reach the app unless you raise it to match, as
above. If you're on `ingress-nginx`, that also means Kubernetes has its own
proxy hop in front of the app — see
[NGINX_SSL_CLOUDFLARE.md](./NGINX_SSL_CLOUDFLARE.md) for the `TRUST_PROXY`
hop-count reasoning, and set it to account for both `ingress-nginx` and any
cloud load balancer in front of it.

## ConfigMap / Secret split

Match `backend/.env.example`: non-sensitive defaults go in a ConfigMap,
credentials/keys go in a Secret (ideally synced from a real secret manager
via External Secrets Operator rather than committed as a Kubernetes Secret
manifest).

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: metabsp-config }
data:
  NODE_ENV: production
  PORT: "5000"
  TRUST_PROXY: "1"                     # adjust for your actual ingress chain
  WHATSAPP_API_VERSION: v20.0
  WHATSAPP_TEMPLATE_LANGUAGE: en_US
  WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE: "true"
  JWT_EXPIRES_IN: 7d
  LOG_LEVEL: info
  ENABLE_SCHEDULED_BACKUPS: "false"    # see docs/BACKUP_RESTORE.md — prefer a CronJob instead
  CASHFREE_ENV: production
  SENTRY_TRACES_SAMPLE_RATE: "0.1"
---
apiVersion: v1
kind: Secret
metadata: { name: metabsp-secrets }
type: Opaque
stringData:
  MONGO_URI: ...
  REDIS_URL: ...               # or REDIS_CLUSTER_NODES for a Redis Cluster
  JWT_SECRET: ...
  WHATSAPP_TOKEN_ENCRYPTION_KEY: ...
  META_APP_ID: ...
  META_APP_SECRET: ...
  META_API_TOKEN: ...
  META_EMBEDDED_SIGNUP_CONFIG_ID: ...
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: ...
  CLOUDINARY_CLOUD_NAME: ...
  CLOUDINARY_API_KEY: ...
  CLOUDINARY_API_SECRET: ...
  CASHFREE_CLIENT_ID: ...
  CASHFREE_CLIENT_SECRET: ...
  ANTHROPIC_API_KEY: ...
  SENTRY_DSN: ...
```

Leave `ENABLE_SCHEDULED_BACKUPS=false` and instead run
`backend/scripts/backup-mongo.sh` as a Kubernetes `CronJob` (from the same
image, command overridden) writing to a bucket-backed volume — see
`docs/BACKUP_RESTORE.md` for why platform-native scheduling (its "option
1") is preferred over the in-process scheduler for anything with
restart/scaling policies that could leave gaps.

## Frontend

The frontend image (`frontend/Dockerfile`) is just nginx serving a static
build — a `Deployment` + `Service` + `Ingress` for it works, but for most
setups a CDN/static-hosting product (see the cloud-specific guides' "CDN +
storage" sections) is simpler and cheaper than running nginx pods just to
serve static files. If you do run it in-cluster, it needs its own Ingress
host (e.g. `app.yourdomain.com`) pointing at the frontend Service, separate
from the API Ingress above.

## Next steps

- [MONITORING.md](./MONITORING.md) for readiness/liveness alerting and
  shipping pod logs (most clusters already run a log-collection DaemonSet
  — Fluent Bit/Fluentd/Datadog agent — that scrapes container stdout,
  where this app's pino JSON logs land automatically).
- [SCALING.md](./SCALING.md) for HPA configuration on the API and worker
  Deployments.
- [HIGH_AVAILABILITY.md](./HIGH_AVAILABILITY.md) for what's genuinely not
  safe to run at replicas > 1 yet.
