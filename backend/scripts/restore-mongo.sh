#!/usr/bin/env bash
# Restores a MongoDB archive produced by backup-mongo.sh. DESTRUCTIVE by
# default (--drop) — restores collection-by-collection over whatever
# already exists at MONGO_URI, so double-check the target before running
# this against anything but a fresh/disaster-recovery database.
#
# Usage: MONGO_URI=... ./scripts/restore-mongo.sh ./backups/metabsp-20260101T000000Z.gz
set -euo pipefail

: "${MONGO_URI:?MONGO_URI must be set}"
ARCHIVE_PATH="${1:?Usage: restore-mongo.sh <path-to-archive.gz>}"

if [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "Archive not found: ${ARCHIVE_PATH}" >&2
  exit 1
fi

echo "Restoring ${ARCHIVE_PATH} -> ${MONGO_URI%%\?*} (--drop)"
mongorestore --uri="${MONGO_URI}" --archive="${ARCHIVE_PATH}" --gzip --drop

echo "Restore complete."
