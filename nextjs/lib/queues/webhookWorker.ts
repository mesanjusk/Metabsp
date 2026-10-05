import { Worker } from 'bullmq';
import { getRedisConnection } from '../db/redis';
import { processWebhookEnvelope } from '../whatsapp/webhookHandler';
import logger from '../utils/logger';
import { WEBHOOK_QUEUE_NAME } from './webhookQueue';
import {
  markDurableCompleted,
  markDurableFailed,
  markDurableProcessing,
} from '../services/durableQueueJournal';

/**
 * Consumes inbound Meta webhook envelopes and runs the real processing —
 * persistence, contact upsert, media re-upload, destination fan-out, auto-reply
 * and workflow matching — off the request path.
 *
 * Concurrency is higher than the send worker's because these jobs are mostly
 * IO-bound waits (Meta media download, Cloudinary upload, customer webhook
 * destinations) rather than calls against a rate-limited Meta send endpoint.
 */
export function startWebhookWorker({
  concurrency = Number(process.env.WEBHOOK_WORKER_CONCURRENCY) || 10,
} = {}) {
  const worker = new Worker(
    WEBHOOK_QUEUE_NAME,
    async (job) => {
      const durableId = String(job.data?.durableId || '');
      if (durableId) await markDurableProcessing(durableId);
      try {
        const result = await processWebhookEnvelope(job.data?.envelope);
        if (durableId) await markDurableCompleted(durableId);
        return result;
      } catch (error) {
        if (durableId) await markDurableFailed(durableId, error);
        throw error;
      }
    },
    {
      connection: getRedisConnection() as any,
      concurrency,
    }
  );

  worker.on('failed', (job, error) => {
    logger.warn(
      `[webhook-worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${error.message}`
    );
  });

  worker.on('error', (error) => {
    logger.error('[webhook-worker] Worker error:', error.message);
  });

  logger.info(`[webhook-worker] Started (concurrency ${concurrency})`);
  return worker;
}
