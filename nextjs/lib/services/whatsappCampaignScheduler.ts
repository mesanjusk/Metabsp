import { connectDB } from '../db/mongo';
import SmbRecord from '../models/SmbRecord';
import { enqueueBroadcastRecipients } from '../queues/whatsappSendQueue';
import logger from '../utils/logger';
import { withLeaderLock } from './schedulerLock';

const POLL_INTERVAL_MS = 30 * 1000;
const BATCH_SIZE = 10;

/**
 * Durable WhatsApp campaign scheduler.
 *
 * Scheduled campaigns live in the existing SmbRecord collection until they
 * are due. That is intentional: the current free Redis deployment has no
 * persistence, so relying only on BullMQ delayed jobs could lose a campaign
 * during a Redis restart. At due time this scheduler enqueues the recipients
 * onto the normal WhatsApp send queue.
 */
export async function runScheduledWhatsAppCampaigns() {
  await connectDB();

  const due: any[] = await SmbRecord.find({
    kind: 'whatsapp_campaign',
    status: 'scheduled',
    dueAt: { $lte: new Date() },
  })
    .sort({ dueAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  let queued = 0;

  for (const item of due) {
    const claimed: any = await SmbRecord.findOneAndUpdate(
      { _id: item._id, kind: 'whatsapp_campaign', status: 'scheduled' },
      { $set: { status: 'processing', 'data.startedAt': new Date() } },
      { new: true }
    ).lean();

    if (!claimed) continue;

    const data: any = claimed.data || {};
    const recipients = Array.isArray(data.recipients) ? data.recipients.filter(Boolean) : [];
    const accountId = String(data.whatsappAccountId || '');
    const campaignId = String(data.campaignId || claimed.reference || '');

    if (!accountId || !campaignId || !recipients.length || !String(data.templateName || '').trim()) {
      await SmbRecord.updateOne(
        { _id: claimed._id },
        {
          $set: {
            status: 'failed',
            completedAt: new Date(),
            'data.lastError': 'Scheduled campaign is missing its account, recipients, campaign ID, or template.',
          },
          $inc: { 'data.scheduleAttempts': 1 },
        }
      );
      logger.error(`[whatsapp-campaigns] Campaign ${claimed._id} has invalid persisted data and was marked failed.`);
      continue;
    }

    try {
      await enqueueBroadcastRecipients({
        accountId,
        userId: String(claimed.userId),
        recipients,
        messageType: 'template',
        body: '',
        templateName: String(data.templateName),
        language: String(data.language || 'en_US'),
        components: Array.isArray(data.components) ? data.components : [],
        campaignId,
      });

      await SmbRecord.updateOne(
        { _id: claimed._id },
        {
          $set: {
            status: 'queued',
            'data.queuedAt': new Date(),
            'data.lastError': '',
          },
          $inc: { 'data.scheduleAttempts': 1 },
        }
      );
      queued += 1;
      logger.info(`[whatsapp-campaigns] Queued campaign ${campaignId} for ${recipients.length} recipient(s).`);
    } catch (error: any) {
      // Queue outages are transient. Put the campaign back into scheduled so
      // the next tick retries it; Mongo remains the durable source of truth.
      await SmbRecord.updateOne(
        { _id: claimed._id },
        {
          $set: {
            status: 'scheduled',
            'data.lastError': String(error?.message || 'Could not enqueue campaign'),
          },
          $inc: { 'data.scheduleAttempts': 1 },
        }
      );
      logger.error(`[whatsapp-campaigns] Could not enqueue campaign ${campaignId}; will retry:`, error?.message);
    }
  }

  return { scanned: due.length, queued };
}

export function startWhatsAppCampaignScheduler({ intervalMs = POLL_INTERVAL_MS } = {}) {
  const tick = () =>
    withLeaderLock('whatsapp-campaigns', runScheduledWhatsAppCampaigns, {
      ttlMs: Math.max(15_000, Math.min(intervalMs - 1_000, 25_000)),
    }).catch((error: any) => logger.error('[whatsapp-campaigns] Scheduler tick failed:', error.message));

  // Recover campaigns that became due while the service was asleep/redeploying.
  void tick();

  const timer = setInterval(tick, intervalMs);
  timer.unref();
  logger.info(`[whatsapp-campaigns] Scheduler started (every ${Math.round(intervalMs / 1000)}s)`);
  return timer;
}
