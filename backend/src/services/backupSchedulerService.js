const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

// Inert unless explicitly enabled — a backup job invokes `mongodump`
// (a system binary, not a Node dependency) on a schedule, which isn't
// something every deployment wants running by default without an operator
// first confirming the binary is installed and BACKUP_DIR is a real,
// persistent (ideally off-host) mount. See docs/BACKUP_RESTORE.md.
const isEnabled = () => String(process.env.ENABLE_SCHEDULED_BACKUPS || '').toLowerCase() === 'true';

async function runScheduledBackup() {
  if (!isEnabled()) return { ran: false, reason: 'ENABLE_SCHEDULED_BACKUPS is not set to true' };

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) return { ran: false, reason: 'MONGO_URI is not set' };

  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archivePath = path.join(backupDir, `metabsp-${timestamp}.gz`);

  try {
    await execFileAsync('mongodump', [`--uri=${mongoUri}`, `--archive=${archivePath}`, '--gzip'], {
      timeout: 15 * 60 * 1000, // large deployments may take a while; don't hang forever
    });
    logger.info(`[backup-scheduler] Backup written to ${archivePath}`);
    return { ran: true, archivePath };
  } catch (error) {
    logger.error('[backup-scheduler] Backup run failed:', error.message);
    return { ran: true, error: error.message };
  }
}

// .unref() so this background poller never keeps the process alive by
// itself (matches every other scheduler in this app).
function startBackupScheduler({ intervalMs = 24 * 60 * 60 * 1000 } = {}) {
  if (!isEnabled()) {
    logger.info('[backup-scheduler] Disabled (set ENABLE_SCHEDULED_BACKUPS=true to enable)');
    return null;
  }

  return setInterval(() => {
    runScheduledBackup().catch((error) =>
      logger.error('[backup-scheduler] Scheduled run failed:', error.message)
    );
  }, intervalMs).unref();
}

module.exports = { runScheduledBackup, startBackupScheduler, isEnabled };
