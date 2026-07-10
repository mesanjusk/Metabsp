# Backup & Restore Strategy

## What needs backing up

- **MongoDB** — the system of record for everything (accounts, messages,
  contacts, auto-reply/workflow rules, subscriptions/invoices, audit logs).
  This is the only datastore that needs a durable backup.
- **Redis** — intentionally *not* backed up. It holds only the BullMQ send
  queue and rate-limit counters, both ephemeral/reconstructable state. Losing
  it loses in-flight queue jobs (recoverable by re-triggering the broadcast)
  and resets rate-limit windows — never a data-loss event.
- **Encrypted fields** — WhatsApp access tokens are stored AES-256-GCM
  encrypted (`src/utils/crypto.js`) using `TOKEN_ENCRYPTION_KEY`. A MongoDB
  backup is only as good as that key: **back up `TOKEN_ENCRYPTION_KEY` and
  `JWT_SECRET` separately from the database dump**, in a secrets manager, not
  alongside the Mongo archive. A restored database is useless without them
  (tokens undecryptable, all existing JWTs invalid).

## How

`backend/scripts/backup-mongo.sh` wraps `mongodump` into a single timestamped,
gzipped archive:

```bash
MONGO_URI="$MONGO_URI" BACKUP_DIR=/var/backups/metabsp npm run backup:mongo --prefix backend
```

Requires the MongoDB Database Tools (`mongodump`/`mongorestore`) on the host
running the backup — a separate install from the `mongod`/driver.

### Scheduling

Two options, pick one:

1. **Platform-native scheduling** (still the recommended default) — a cron
   job, a scheduled CI job, or your host's own cron/task feature (Render,
   Railway, etc.) pointed at `npm run backup:mongo`. Works regardless of
   whether the app process itself is running.
2. **In-process scheduler** (`src/services/backupSchedulerService.js`) — set
   `ENABLE_SCHEDULED_BACKUPS=true` and `BACKUP_DIR` and the backend itself
   runs `mongodump` on a 24h interval (`startBackupScheduler()` in
   `src/index.js`), no separate cron infrastructure needed. Off by default;
   requires the same `mongodump` binary as the shell script. Ties the
   backup's schedule to the app process's uptime, so option 1 is still
   preferable for anything running with restart/scaling policies that could
   leave gaps.

**Suggested cadence:** daily full dump, retained 14 days, plus a weekly dump
retained 90 days. Store archives off the database host (S3/GCS/equivalent) —
a backup on the same disk as the database it's backing up protects against
nothing.

### Restore

```bash
MONGO_URI="$MONGO_URI" npm run restore:mongo --prefix backend -- /path/to/metabsp-<timestamp>.gz
```

`restore-mongo.sh` runs `mongorestore --drop`, which replaces existing
collections with the archive's contents — destructive by design (a restore
should fully reinstate a known-good state, not merge with whatever's
currently there). Never point this at a live production database except
during an actual disaster-recovery event.

### Restore drills

A backup that's never been restored is unverified. Periodically (quarterly
is a reasonable default) restore the latest archive into a scratch
environment and run:

```bash
MONGO_URI="$SCRATCH_MONGO_URI" WHATSAPP_TOKEN_ENCRYPTION_KEY="$KEY" npm run verify-restore --prefix backend
```

`backend/scripts/verify-restore.js` automates the three checks that used to
be a manual checklist:

1. The app can connect to the restored database at all.
2. Row counts on the key collections (`whatsappaccounts`, `messages`,
   `contacts`, `users`, `organizations`) are non-zero (or plausibly zero, if
   the source genuinely had none) — not a raw exception on query.
3. A sample WhatsApp account's `accessTokenEncrypted` actually decrypts with
   the currently configured key — this is the check that catches "restored
   the database but not the key that goes with it," the single most common
   way a restore silently fails to be useful. It also exercises the
   previous-key fallback (see `WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS` in
   `src/utils/crypto.js`) if the restored data predates a key rotation.

Exits 0 if every check passes, non-zero otherwise — safe to wire into a
disaster-recovery runbook or a CI job that runs the drill on a schedule.

## Point-in-time recovery

`mongodump`/`mongorestore` only gives you discrete snapshots, not
point-in-time recovery between them. If RPO requirements are tighter than
"up to 24h of data loss," use your MongoDB hosting provider's native
continuous backup/oplog-based PITR (e.g., MongoDB Atlas Continuous Backup)
instead of/in addition to this script — that's a hosting-tier feature this
repo can't provide from application code.
