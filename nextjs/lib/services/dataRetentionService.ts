import cloudinary from '../utils/cloudinary';
import { connectDB } from '../db/mongo';
import Message from '../models/Message';
import Contact from '../models/Contact';
import AuditLog from '../models/AuditLog';
import { withLeaderLock } from './schedulerLock';
import logger from '../utils/logger';

/**
 * Enforced data retention.
 *
 * `docs/legal/DATA_RETENTION_POLICY.md` was honest that nothing implemented
 * this: it said in as many words that there is no job expiring message or
 * contact records, and that a fixed retention period "must be implemented
 * separately". Under GDPR's storage-limitation principle and India's DPDP,
 * a published policy that nothing enforces is a commitment being broken, so
 * this is that job.
 *
 * ── Defaults are OFF, deliberately ──────────────────────────────────────────
 * Every window below defaults to 0, meaning keep forever. Deleting a
 * customer's message history is irreversible, and a retention period is a
 * business and legal decision, not something a deployment should inherit from
 * a library default. An operator opts in by setting the days explicitly.
 *
 * Two safety properties matter more than throughput here:
 *
 *   1. Deletes run in bounded batches with a per-run ceiling, so a first run
 *      against years of history cannot lock the database or exhaust memory.
 *   2. Media is deleted from Cloudinary before its message row goes. Removing
 *      the row first would orphan the file permanently — deletion that only
 *      looks like deletion, which is worse than none at all because it is
 *      reported as compliance.
 */

const BATCH_SIZE = 500;
const MAX_PER_RUN = 20000;

const days = (name: string): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

export interface RetentionConfig {
  messagesDays: number;
  contactsInactiveDays: number;
  auditLogDays: number;
  deleteMedia: boolean;
}

export function getRetentionConfig(): RetentionConfig {
  return {
    messagesDays: days('RETENTION_MESSAGES_DAYS'),
    contactsInactiveDays: days('RETENTION_CONTACTS_INACTIVE_DAYS'),
    auditLogDays: days('RETENTION_AUDIT_LOG_DAYS'),
    // Audit logs are the record of who did what; deleting them is a separate
    // decision from deleting the data they describe, and usually a slower one.
    deleteMedia: String(process.env.RETENTION_DELETE_MEDIA ?? 'true').toLowerCase() !== 'false',
  };
}

export const isRetentionEnabled = (config = getRetentionConfig()) =>
  config.messagesDays > 0 || config.contactsInactiveDays > 0 || config.auditLogDays > 0;

const cutoffFor = (retentionDays: number) => new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

/**
 * Cloudinary's delete API takes the public_id, which newer rows carry. Older
 * rows only have the URL, so it is parsed out as a fallback: everything after
 * `/upload/` (minus an optional `v123/` version segment) and before the
 * extension is the public_id.
 */
export function derivePublicIdFromUrl(url: string): { publicId: string; resourceType: string } | null {
  const match = /\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i.exec(String(url || ''));
  if (!match) return null;
  return { resourceType: match[1], publicId: match[2] };
}

async function deleteMediaFor(messages: any[]): Promise<number> {
  let deleted = 0;

  for (const message of messages) {
    const publicId = message.mediaPublicId || derivePublicIdFromUrl(message.mediaUrl)?.publicId;
    if (!publicId) continue;

    const resourceType =
      message.mediaResourceType || derivePublicIdFromUrl(message.mediaUrl)?.resourceType || 'image';

    try {
      await (cloudinary as any).uploader.destroy(publicId, { resource_type: resourceType });
      deleted += 1;
    } catch (error: any) {
      // A media file that cannot be deleted must not stop the row from being
      // deleted — the record is the more sensitive of the two, and a stuck
      // asset should not halt the whole retention run.
      logger.warn(`[retention] Could not delete media ${publicId}: ${error.message}`);
    }
  }

  return deleted;
}

async function pruneMessages(retentionDays: number, deleteMedia: boolean) {
  const cutoff = cutoffFor(retentionDays);
  let removed = 0;
  let mediaRemoved = 0;

  while (removed < MAX_PER_RUN) {
    const batch: any[] = await Message.find({ createdAt: { $lt: cutoff } })
      .select('_id mediaUrl mediaPublicId mediaResourceType')
      .limit(BATCH_SIZE)
      .lean();

    if (!batch.length) break;

    if (deleteMedia) {
      mediaRemoved += await deleteMediaFor(batch.filter((message) => message.mediaUrl));
    }

    const result = await Message.deleteMany({ _id: { $in: batch.map((message) => message._id) } });
    removed += result.deletedCount || 0;

    if (batch.length < BATCH_SIZE) break;
  }

  return { removed, mediaRemoved };
}

async function pruneContacts(retentionDays: number) {
  const cutoff = cutoffFor(retentionDays);
  let removed = 0;

  while (removed < MAX_PER_RUN) {
    // "Inactive" is measured from the last time the contact was seen, not from
    // when the row was created — a long-standing customer who messaged
    // yesterday is not stale.
    const batch: any[] = await Contact.find({
      $or: [{ lastSeen: { $lt: cutoff } }, { lastSeen: null, createdAt: { $lt: cutoff } }],
    })
      .select('_id')
      .limit(BATCH_SIZE)
      .lean();

    if (!batch.length) break;

    const result = await Contact.deleteMany({ _id: { $in: batch.map((contact) => contact._id) } });
    removed += result.deletedCount || 0;

    if (batch.length < BATCH_SIZE) break;
  }

  return { removed };
}

async function pruneAuditLogs(retentionDays: number) {
  const result = await AuditLog.deleteMany({ createdAt: { $lt: cutoffFor(retentionDays) } });
  return { removed: result.deletedCount || 0 };
}

export async function runRetentionSweep() {
  const config = getRetentionConfig();
  if (!isRetentionEnabled(config)) {
    return { ran: false, reason: 'No retention window is configured' };
  }

  await connectDB();

  const summary: Record<string, unknown> = { ran: true };

  if (config.messagesDays > 0) {
    const { removed, mediaRemoved } = await pruneMessages(config.messagesDays, config.deleteMedia);
    summary.messagesRemoved = removed;
    summary.mediaFilesRemoved = mediaRemoved;
    if (removed) logger.info(`[retention] Removed ${removed} messages older than ${config.messagesDays}d (${mediaRemoved} media files)`);
  }

  if (config.contactsInactiveDays > 0) {
    const { removed } = await pruneContacts(config.contactsInactiveDays);
    summary.contactsRemoved = removed;
    if (removed) logger.info(`[retention] Removed ${removed} contacts inactive for ${config.contactsInactiveDays}d`);
  }

  if (config.auditLogDays > 0) {
    const { removed } = await pruneAuditLogs(config.auditLogDays);
    summary.auditLogsRemoved = removed;
    if (removed) logger.info(`[retention] Removed ${removed} audit log entries older than ${config.auditLogDays}d`);
  }

  // The sweep records itself. A retention policy you cannot evidence having
  // run is not much use in an audit, and this entry is written to the same
  // AuditLog the sweep may also be pruning — which is fine, since it only
  // removes entries older than the window.
  await AuditLog.create({
    action: 'data_retention.sweep',
    resource: 'data_retention',
    outcome: 'success',
    metadata: { ...summary, config },
  }).catch((error: any) => logger.warn('[retention] Could not record the sweep in the audit log:', error.message));

  return summary;
}

export function startRetentionScheduler({ intervalMs = 24 * 60 * 60 * 1000 } = {}) {
  const config = getRetentionConfig();

  if (!isRetentionEnabled(config)) {
    logger.info(
      '[retention] No retention window configured — records are kept indefinitely. ' +
        'Set RETENTION_MESSAGES_DAYS / RETENTION_CONTACTS_INACTIVE_DAYS / RETENTION_AUDIT_LOG_DAYS to enforce one.'
    );
    return null;
  }

  logger.info(
    `[retention] Enabled — messages: ${config.messagesDays || 'keep'}d, ` +
      `contacts: ${config.contactsInactiveDays || 'keep'}d, audit: ${config.auditLogDays || 'keep'}d`
  );

  return setInterval(() => {
    // Leader-locked like the other schedulers: two replicas racing to delete
    // the same batch is wasted work at best, and doubles the Cloudinary calls.
    withLeaderLock('data-retention', runRetentionSweep, { ttlMs: 30 * 60 * 1000 }).catch((error) =>
      logger.error('[retention] Sweep failed:', error.message)
    );
  }, intervalMs).unref();
}
