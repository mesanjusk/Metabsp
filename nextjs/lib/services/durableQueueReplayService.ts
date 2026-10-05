import { Queue } from 'bullmq';
import { getRedisConnection } from '../db/redis';
import logger from '../utils/logger';
import { QUEUE_NAME as WHATSAPP_SEND_QUEUE_NAME } from '../queues/whatsappSendQueue';
import { WEBHOOK_QUEUE_NAME } from '../queues/webhookQueue';
import {
  cleanupDurableQueueJournal,
  getRecoverableDurableJobs,
  markDurableQueued,
} from './durableQueueJournal';
import { withLeaderLock } from './schedulerLock';

const REPLAY_INTERVAL_MS = Math.max(10_000, Number(process.env.DURABLE_QUEUE_REPLAY_INTERVAL_MS || 30_000));

let webhookQueue: Queue | null = null;
let sendQueue: Queue | null = null;

const getWebhookReplayQueue = () =>
  (webhookQueue ||= new Queue(WEBHOOK_QUEUE_NAME, { connection: getRedisConnection() as any }));

const getSendReplayQueue = () =>
  (sendQueue ||= new Queue(WHATSAPP_SEND_QUEUE_NAME, { connection: getRedisConnection() as any }));

export async function replayDurableQueueJobs() {
  const jobs: any[] = await getRecoverableDurableJobs({ limit: 100 });
  let replayed = 0;
  let failed = 0;

  for (const journal of jobs) {
    const delay = Math.max(0, new Date(journal.availableAt || Date.now()).getTime() - Date.now());

    try {
      if (journal.kind === 'webhook') {
        await getWebhookReplayQueue().add(
          'inbound',
          { envelope: journal.payload, durableId: journal._id },
          {
            jobId: String(journal._id),
            attempts: 5,
            backoff: { type: 'exponential', delay: 3000 },
            removeOnComplete: { age: 60 * 60, count: 5000 },
            removeOnFail: { count: 10000 },
          }
        );
      } else if (journal.kind === 'whatsapp_send') {
        await getSendReplayQueue().add(
          'send',
          { ...(journal.payload || {}), durableId: journal._id },
          {
            jobId: String(journal._id),
            delay,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { age: 60 * 60 },
            removeOnFail: { count: 5000 },
          }
        );
      } else {
        logger.error(`[durable-queue] Unknown journal kind ${journal.kind} for ${journal._id}`);
        failed += 1;
        continue;
      }

      await markDurableQueued(String(journal._id));
      replayed += 1;
    } catch (error: any) {
      // Leave the Mongo row recoverable. The next scheduler tick retries it.
      failed += 1;
      logger.error(`[durable-queue] Replay failed for ${journal._id}:`, error?.message || error);
    }
  }

  const cleanup = await cleanupDurableQueueJournal();
  if (jobs.length || cleanup.deleted) {
    logger.info(
      `[durable-queue] Replay scan: ${jobs.length} recoverable, ${replayed} requeued, ${failed} failed, ${cleanup.deleted} old completions removed`
    );
  }

  return { scanned: jobs.length, replayed, failed, cleaned: cleanup.deleted };
}

export function startDurableQueueReplayScheduler({ intervalMs = REPLAY_INTERVAL_MS } = {}) {
  const tick = () =>
    withLeaderLock('durable-queue-replay', replayDurableQueueJobs, {
      ttlMs: Math.max(8_000, Math.min(intervalMs - 1_000, 25_000)),
    }).catch((error: any) =>
      logger.error('[durable-queue] Replay scheduler failed:', error?.message || error)
    );

  // Recover anything Redis lost during a restart/deploy as soon as the new
  // instance is warm, then continue polling for stale queued/processing jobs.
  const bootTimer = setTimeout(() => void tick(), 5_000);
  bootTimer.unref();

  const timer = setInterval(tick, intervalMs);
  timer.unref();
  logger.info(`[durable-queue] Replay scheduler started (every ${Math.round(intervalMs / 1000)}s)`);
  return timer;
}
