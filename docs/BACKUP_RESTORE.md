# Backup & Restore Strategy

## Production design

MongoDB is the system of record. Redis is now a dispatch/cache layer for
WhatsApp queue work rather than the only durable copy.

Accepted inbound WhatsApp webhook envelopes and outbound WhatsApp sends are
journaled in Mongo (`DurableQueueJob`) before/alongside BullMQ. If the Render
Redis instance restarts with persistence disabled, the durable replay scheduler
reconstructs stale/lost jobs with the same deterministic job IDs.

Database backups do **not** depend on Render local disk or the `mongodump`
binary. The application creates an Extended JSON logical snapshot, gzip
compresses it, encrypts it with AES-256-GCM using `BACKUP_ENCRYPTION_KEY`, and
uploads the encrypted artifact as a raw asset to the configured Cloudinary
account.

The encrypted Cloudinary object is off-host. Anyone who obtains the asset URL
still needs the separate 32-byte backup encryption key to read it.

## Required production configuration

- `ENABLE_SCHEDULED_BACKUPS=true`
- `BACKUP_ENCRYPTION_KEY` — base64-encoded 32 random bytes. Do not reuse the
  WhatsApp token encryption key.
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `BACKUP_CLOUDINARY_FOLDER=system_backups`
- `BACKUP_RETENTION_DAYS=30`
- `BACKUP_MIN_INTERVAL_HOURS=20`
- `BACKUP_MAX_AGE_HOURS=26`

The deploy gate refuses a production build when scheduled backups are enabled
without a valid backup key or Cloudinary configuration.

## Schedule and monitoring

The backup scheduler checks hourly. It runs a snapshot when the latest
successful backup is older than `BACKUP_MIN_INTERVAL_HOURS`, so service deploys
do not create duplicate daily archives and a missed run is caught quickly.

`GET /api/health?strict=1` reports:

- `backupReady`
- `backupAgeHours`
- `durableQueueRecoverable`

When backups are enabled, a stale/missing backup makes the strict monitoring
probe return 503. Render's deployment health check remains plain `/api/health`,
so an external backup outage alerts operators without blocking deployment of a
fix.

Administrators can inspect recent backup history or force a backup through
`GET/POST /api/admin/backups`.

## Backup contents

The snapshot contains every physical application collection except the backup
history collection itself. Documents use MongoDB Extended JSON in canonical
mode, so ObjectIds, dates, decimals, binary values and other BSON types survive
round-trip restoration.

For each collection the backup also records its collection options and indexes.
The restore tool recreates documents and indexes.

## Restore drill

Never test a restore against the live production database.

1. Create/use a scratch Mongo database.
2. Set its URI as `MONGO_URI`.
3. Set the same `BACKUP_ENCRYPTION_KEY` used by production and the Cloudinary
   credentials that hold the archive.
4. Run:

```bash
RESTORE_CONFIRM=YES_I_UNDERSTAND \
MONGO_URI="$SCRATCH_MONGO_URI" \
BACKUP_ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY" \
CLOUDINARY_CLOUD_NAME="$CLOUDINARY_CLOUD_NAME" \
CLOUDINARY_API_KEY="$CLOUDINARY_API_KEY" \
CLOUDINARY_API_SECRET="$CLOUDINARY_API_SECRET" \
npm run restore:cloud
```

With no argument, `restore:cloud` selects the newest encrypted backup. To
restore a specific artifact, append its Cloudinary public ID.

5. Verify the restored database:

```bash
MONGO_URI="$SCRATCH_MONGO_URI" \
WHATSAPP_TOKEN_ENCRYPTION_KEY="$WHATSAPP_TOKEN_ENCRYPTION_KEY" \
WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS="$WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS" \
npm run verify-restore
```

A backup is not considered operationally proven until the restore verification
passes against a scratch database.

## Legacy scripts

`backup-mongo.sh` / `restore-mongo.sh` remain available for operators who run
MongoDB Database Tools on a host with durable storage. They are no longer the
production backup mechanism for the current Render deployment.

## Recovery objectives

The application backup is a periodic snapshot, not point-in-time recovery.
With the default schedule, the application-level RPO is roughly one day.
If the business later needs minute-level recovery, enable the MongoDB hosting
provider's continuous/PITR backup product in addition to these application
snapshots.
