# Monitoring

How to actually turn on production observability for this app. Nothing
here ships pre-wired to an external service — this is what's already
built into the codebase and how to point it somewhere.

## Error tracking / APM: Sentry

`backend/src/instrument.js` is fully inert until `SENTRY_DSN` is set:

```js
const isEnabled = Boolean(process.env.SENTRY_DSN);
if (isEnabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
  });
}
```

To enable: set `SENTRY_DSN` (from your Sentry project settings) and
optionally `SENTRY_TRACES_SAMPLE_RATE` (defaults to `0.1`, i.e. 10% of
transactions traced — raise it in staging if you want fuller traces, lower
it in production once you have a baseline and just want to control cost).
`backend/src/app.js` calls `Sentry.setupExpressErrorHandler(app)` only
`if (isSentryEnabled)`, so unhandled route errors flow to Sentry
automatically once the DSN is set — no additional code change needed.

One thing to verify yourself before relying on this in production: the
file's own comment notes "no account/DSN was available to verify this live
in this environment" — confirm `Sentry.init()`/`setupExpressErrorHandler()`
match your actual `@sentry/node` version's current Express integration
against Sentry's quickstart docs before treating it as fully wired.

Sentry must be `require`d before any other app module (already the case —
`instrument.js` is required at the top of `backend/src/app.js`) since its
auto-instrumentation patches HTTP/Express/Mongo at require time. The
standalone worker (`backend/src/worker.js`) does **not** currently require
`instrument.js` — if you want worker-side errors in Sentry too (e.g. a
broadcast job repeatedly failing), add the same `require('./instrument')`
at the top of `worker.js`.

## Structured logs: pino

`backend/src/utils/logger.js` wraps `pino`, writing structured JSON to
stdout — `LOG_LEVEL` (default `info` in production, `debug` otherwise)
controls verbosity, and sensitive fields (`req.headers.authorization`,
`*.accessToken`, `*.accessTokenEncrypted`, `*.password`, `*.token`,
`*.otp`) are redacted before serialization, so logs are safe to ship to a
third party without a separate scrubbing step. `pino-http` in
`backend/src/app.js` auto-logs every request except `/health` and `/`
(deliberately excluded from `autoLogging` since uptime checks would
otherwise flood the log stream).

This repo doesn't ship a log shipper itself — pino writes to stdout, and
you're expected to scrape that with whatever your platform provides:

- **Docker/Compose/Kubernetes**: the container runtime already captures
  stdout; point a log-collection agent (Fluent Bit, Fluentd, the Datadog
  Agent, Grafana Alloy for Loki) at the container log files/`docker logs`
  API. Since the logs are already JSON, most of these need zero parsing
  config — just point them at stdout and let them auto-detect JSON lines.
- **ECS/Cloud Run/Container Apps/GKE**: each of these ships container
  stdout to the platform's native log sink automatically (CloudWatch Logs,
  Cloud Logging, Log Analytics) with no extra agent to install — see the
  relevant section of [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md),
  [GCP_DEPLOYMENT.md](./GCP_DEPLOYMENT.md), or
  [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md).
- **Self-hosted (Docker Compose on a single VM, see
  [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md))**: run a Loki +
  Promtail or a Datadog Agent container alongside the app containers,
  mounting `/var/lib/docker/containers` (or using the Docker socket) to
  tail the JSON logs.

## Uptime: `GET /health`

`backend/src/app.js`'s `/health` route checks
`mongoose.connection.readyState` and returns `200` with
`{ ok: true, db: 'connected', uptimeSeconds, timestamp }` when connected,
`503` with `db: 'disconnected'` otherwise. Point any external uptime
checker (a cloud load balancer's health check, Pingdom/UptimeRobot/a
synthetic monitor, Kubernetes probes per
[KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md)) at this endpoint
rather than `/` (which always returns `200` unconditionally and tells you
nothing about DB health). `backend/loadtest/README.md` already has a
ready-made `npm run loadtest:health` / `loadtest:health:k6` pair if you
want to establish a latency baseline for this endpoint before setting
alert thresholds against it.

## Security/audit history: the `AuditLog` model

`backend/src/models/AuditLog.js` (see `backend/src/services/
auditLogService.js` for where it's written) records security-relevant
actions: `userId`, `tenantId`, `action`, `resource`/`resourceId`,
`outcome` (`success`/`failure`), `ipAddress`, `userAgent`, and a free-form
`metadata` blob, indexed on `userId`, `tenantId`, `action`, and `createdAt`
descending. This is your source of truth for "who did what, when" —
account changes, billing actions, auth events — independent of the
request-level pino logs. There's no built-in alerting on this collection
today; if you want alerting on it (e.g. a spike in `outcome: 'failure'`
auth events from one IP), you'll need to query it yourself (a scheduled
job, or a BI tool pointed at the Mongo replica) since nothing in this repo
watches it automatically.

## Suggested alerts

None of these are pre-configured — wire them into whatever your
platform's alerting is (CloudWatch Alarms, Azure Monitor, Cloud Monitoring,
Sentry's own alert rules, Grafana):

- **`GET /health` failures** — 2+ consecutive `503`s or failed checks
  from your uptime monitor; this is your first signal of a Mongo
  connectivity problem or a crashed process.
- **Sentry error-rate spikes** — Sentry's own issue-alert rules
  (e.g. "N events in M minutes") once `SENTRY_DSN` is set; this catches
  application-level exceptions the health check can't see.
- **BullMQ failed-job count growth** — query the queue directly
  (`Queue#getFailedCount()` from `backend/src/queues/whatsappSendQueue.js`'s
  queue instance, or BullMQ's own dashboard/Arena/Bull Board if you add
  one) on a schedule; a growing failed-job count usually means Meta API
  errors or a WhatsApp token expiring, not a code bug, so route this
  alert to whoever owns WhatsApp account health, not just on-call
  engineering.
- **Mongo/Redis connection errors in the app's own logs** — both
  `backend/src/config/mongo.js` (via `logger.error("❌ MongoDB connection
  error:", ...)`, which also `process.exit(1)`s) and
  `backend/src/config/redis.js` (`connection.on('error', ...)`, logged but
  non-fatal) emit structured error logs on connection trouble — alert on
  these log patterns in whatever log platform you ship pino output to,
  since a Redis connection error degrades rate limiting/real-time chat/the
  send queue without necessarily crashing the process or failing
  `/health`.

## Next steps

- [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) for what to do once an
  alert above actually fires and it's a real incident.
- [SCALING.md](./SCALING.md) for what metrics actually justify scaling up
  vs. investigating a bug.
