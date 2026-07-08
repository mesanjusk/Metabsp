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

Run this on a schedule wherever the app is deployed — a cron job, a
scheduled CI job, or (on Render/Railway/etc.) the platform's own cron/task
feature pointed at this script. This repo does not assume any specific
platform, so no scheduler is wired up automatically; picking one is a
deploy-time decision.

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
environment and confirm:

1. The app boots against the restored database (`npm start` in `backend/`,
   `GET /health` returns `ok: true`).
2. A sample WhatsApp account's `accessTokenEncrypted` decrypts correctly
   with the corresponding `TOKEN_ENCRYPTION_KEY` (proves the key/backup
   pairing wasn't lost).
3. Row counts on a few key collections (`whatsappaccounts`, `messages`,
   `contacts`) are in the expected ballpark versus the source at dump time.

## Point-in-time recovery

`mongodump`/`mongorestore` only gives you discrete snapshots, not
point-in-time recovery between them. If RPO requirements are tighter than
"up to 24h of data loss," use your MongoDB hosting provider's native
continuous backup/oplog-based PITR (e.g., MongoDB Atlas Continuous Backup)
instead of/in addition to this script — that's a hosting-tier feature this
repo can't provide from application code.
