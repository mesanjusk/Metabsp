import { withLeaderLock } from './schedulerLock';
import logger from '../utils/logger';
import {
  hasRecentSuccessfulBackup,
  runEncryptedCloudBackup,
} from './encryptedBackupService';

const POLL_INTERVAL_MS = Math.max(60 * 60 * 1000, Number(process.env.BACKUP_POLL_INTERVAL_MS || 60 * 60 * 1000));
const MIN_INTERVAL_HOURS = Math.max(1, Number(process.env.BACKUP_MIN_INTERVAL_HOURS || 20));

export const isBackupEnabled = () =>
  String(process.env.ENABLE_SCHEDULED_BACKUPS || '').toLowerCase() === 'true';

export async function runScheduledBackup() {
  if (!isBackupEnabled()) {
    return { ran: false, reason: 'ENABLE_SCHEDULED_BACKUPS is not set to true' };
  }

  const recent = await hasRecentSuccessfulBackup({ maxAgeHours: MIN_INTERVAL_HOURS });
  if (recent.ok) {
    return {
      ran: false,
      reason: `latest encrypted off-host backup is only ${Number(recent.ageHours || 0).toFixed(1)}h old`,
    };
  }

  try {
    return await runEncryptedCloudBackup();
  } catch (error: any) {
    logger.error('[backup-scheduler] Encrypted off-host backup failed:', error?.message || error);
    return { ran: true, error: error?.message || String(error) };
  }
}

export function startBackupScheduler({ intervalMs = POLL_INTERVAL_MS } = {}) {
  if (!isBackupEnabled()) {
    logger.info('[backup-scheduler] Disabled (set ENABLE_SCHEDULED_BACKUPS=true to enable)');
    return null;
  }

  const tick = () =>
    withLeaderLock('scheduled-backup', runScheduledBackup, {
      // The logical dump is bounded by one pass over Mongo plus upload. Keep
      // the leader lock long enough that a second replica cannot start a
      // parallel full-database snapshot.
      ttlMs: 45 * 60 * 1000,
    }).catch((error: any) =>
      logger.error('[backup-scheduler] Scheduled run failed:', error?.message || error)
    );

  // Do not wait 24 hours after a deploy before discovering backups are broken.
  // The service checks whether a recent successful snapshot already exists and
  // skips when one does, so deploys do not create duplicate daily archives.
  const bootTimer = setTimeout(() => void tick(), 30_000);
  bootTimer.unref();

  const timer = setInterval(tick, intervalMs);
  timer.unref();
  logger.info(
    `[backup-scheduler] Enabled — encrypted Cloudinary backup check every ${Math.round(intervalMs / 60_000)} minute(s), minimum ${MIN_INTERVAL_HOURS}h between snapshots`
  );
  return timer;
}
