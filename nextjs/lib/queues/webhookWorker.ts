import { Worker } from 'bullmq';
import { getRedisConnection } from '../db/redis';
import { processWebhookEnvelope } from '../whatsapp/webhookHandler';
import logger from '../utils/logger';
import { WEBHOOK_QUEUE_NAME } from './webhookQueue';

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
    async (job) => processWebhookEnvelope(job.data?.envelope),
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
