# Disaster Recovery

RTO/RPO framing and a runbook outline for recovering this app from a real
incident (database loss/corruption, host loss, region outage). This
builds on `docs/BACKUP_RESTORE.md`'s mechanics rather than duplicating
them — read that document first for the actual backup/restore commands.
See also [HIGH_AVAILABILITY.md](./HIGH_AVAILABILITY.md) for what reduces
how often you need this runbook in the first place.

## RTO/RPO, tied to the actual backup cadence

`docs/BACKUP_RESTORE.md` recommends: "daily full dump, retained 14 days,
plus a weekly dump retained 90 days," stored off the database host, plus
noting that `mongodump`/`mongorestore` only gives discrete snapshots, not
point-in-time recovery, unless you're on a hosting tier with continuous
backup (e.g., MongoDB Atlas Continuous Backup).

That cadence directly sets your **RPO (Recovery Point Objective)**:

- **With daily `mongodump` snapshots only**: RPO is up to ~24 hours — a
  disaster right before the next scheduled dump loses up to a full day of
  writes (new accounts, messages, contacts, invoices, audit log entries).
- **With Atlas Continuous Backup (or equivalent oplog-based PITR)**: RPO
  can be minutes, not hours — if your RPO requirements are tighter than
  "up to 24h of data loss is acceptable," this is the tier feature to add
  rather than trying to shrink the `mongodump` interval, per
  `docs/BACKUP_RESTORE.md`'s own guidance.

**RTO (Recovery Time Objective)** isn't something this repo can quote a
number for — it depends on your archive size, restore infrastructure
speed, and how quickly you can redeploy the app stack. What you can control
and should measure: how long `mongorestore --drop` actually takes against
a copy of your real archive size, plus how long a full app redeploy takes
in your environment (see [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md),
[KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md), or the relevant
cloud guide). Time an actual restore drill (see below) to get a real
number for your environment instead of guessing.

## Runbook outline

### 1. Detect

- `GET /health` returning `503`/timing out, or your uptime monitor firing
  (see [MONITORING.md](./MONITORING.md)).
- Sentry error-rate spike pointing at Mongo/Redis connection failures.
- `backend/src/config/mongo.js`'s `logger.error("❌ MongoDB connection
  error:", ...)` (which also calls `process.exit(1)`, so a crash-looping
  process is itself a symptom) or `backend/src/config/redis.js`'s
  connection-error logs, in your shipped log stream.

Before declaring a full disaster: confirm it's actually data loss/
corruption or full infrastructure loss, not a transient network partition
or a managed-tier failover in progress (multi-AZ Mongo/Redis failovers can
look like a brief outage in logs/health checks and resolve on their own
within seconds to low-minutes — don't restore from backup reflexively for
something that self-heals).

### 2. Restore from the latest backup

Per `docs/BACKUP_RESTORE.md`:

```bash
MONGO_URI="$RECOVERY_MONGO_URI" npm run restore:mongo --prefix backend -- /path/to/metabsp-<timestamp>.gz
```

Point `RECOVERY_MONGO_URI` at either a rebuilt/new database instance (host
loss) or the existing one after resolving whatever corrupted it (in which
case, restoring is genuinely destructive — `mongorestore --drop` replaces
existing collections outright, which is the point in an actual DR event
but not something to run against a database that's otherwise fine).

Recover the two secrets `docs/BACKUP_RESTORE.md` calls out as
backed-up-separately-from-the-database at this step too:
`WHATSAPP_TOKEN_ENCRYPTION_KEY` and `JWT_SECRET`, from whichever secrets
manager holds them (Secrets Manager/Key Vault/Secret Manager — see the
cloud-specific deployment guides). A Mongo restore without these is
useless: WhatsApp tokens stay encrypted-and-undecryptable and every
existing JWT is invalid.

### 3. Run `verify-restore.js`

```bash
MONGO_URI="$RECOVERY_MONGO_URI" WHATSAPP_TOKEN_ENCRYPTION_KEY="$KEY" npm run verify-restore --prefix backend
```

Per `docs/BACKUP_RESTORE.md`, this checks connectivity, non-zero row
counts on key collections (`whatsappaccounts`, `messages`, `contacts`,
`users`, `organizations`), and that a sample WhatsApp account's encrypted
token actually decrypts with the recovered key — the single check that
catches "restored the database but not the key that goes with it." Exits
non-zero on any failure; **do not proceed to redeploy on a non-zero
exit** — investigate first, since a restore that fails this check is not
actually recovered, just silently broken in a way that surfaces later as
customer-facing WhatsApp send failures.

### 4. Redeploy the app stack against the recovered database

Point the app's `MONGO_URI` (and, if Redis was also lost/rebuilt, a fresh
`REDIS_URL`/`REDIS_CLUSTER_NODES` — remember Redis itself never needs
restoring per `docs/BACKUP_RESTORE.md`, just a fresh empty instance) at
the recovered infrastructure and redeploy using whichever path matches
your environment ([Docker](./DOCKER_DEPLOYMENT.md),
[Kubernetes](./KUBERNETES_DEPLOYMENT.md),
[AWS](./AWS_DEPLOYMENT.md)/[Azure](./AZURE_DEPLOYMENT.md)/
[GCP](./GCP_DEPLOYMENT.md)). If this is a fresh database (not an in-place
restore), remember `autoIndex` is disabled in production
(`backend/src/config/mongo.js`) — run index creation explicitly per
[REDIS_AND_MONGODB_OPS.md](./REDIS_AND_MONGODB_OPS.md) before real traffic
hits it, or queries will run unindexed until you do.

### 5. Validate

- `/health` returns `200`.
- Log in as a real (or test) user through the actual login flow — confirms
  `JWT_SECRET` recovery worked end-to-end, not just that the restore
  script's own check passed.
- Send or receive one real (or sandboxed) WhatsApp message — confirms
  `WHATSAPP_TOKEN_ENCRYPTION_KEY` recovery holds up for a live Graph API
  call, not just the decrypt-a-sample-token check `verify-restore.js`
  already did.
- Check the `AuditLog` collection (`backend/src/models/AuditLog.js`) is
  receiving new entries, confirming writes are actually landing
  post-recovery.

## Restore drills

Per `docs/BACKUP_RESTORE.md`: run this whole flow quarterly against a
scratch environment, not just when an incident happens — "a backup that's
never been restored is unverified." Doing this on a schedule is also how
you get a real RTO number for your environment instead of guessing at one
during an actual incident, when you can least afford surprises.

## Next steps

- `docs/BACKUP_RESTORE.md` for the underlying backup mechanics and
  scheduling options this runbook depends on.
- [HIGH_AVAILABILITY.md](./HIGH_AVAILABILITY.md) for reducing how often a
  full DR event happens in the first place (multi-AZ managed tiers).
- [MONITORING.md](./MONITORING.md) for the detection signals referenced in
  step 1.
