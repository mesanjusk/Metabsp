#!/usr/bin/env bash
# Dumps the MongoDB database backing this app to a timestamped, gzipped
# archive. Requires the `mongodump` binary (part of the MongoDB Database
# Tools, not the mongod server) and MONGO_URI in the environment.
#
# Usage: BACKUP_DIR=/var/backups/metabsp ./scripts/backup-mongo.sh
set -euo pipefail

: "${MONGO_URI:?MONGO_URI must be set}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE_PATH="${BACKUP_DIR}/metabsp-${TIMESTAMP}.gz"

mkdir -p "${BACKUP_DIR}"

echo "Dumping ${MONGO_URI%%\?*} -> ${ARCHIVE_PATH}"
mongodump --uri="${MONGO_URI}" --archive="${ARCHIVE_PATH}" --gzip

echo "Backup complete: ${ARCHIVE_PATH}"
