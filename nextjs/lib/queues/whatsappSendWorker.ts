import { Worker } from 'bullmq';
import { getRedisConnection } from '../db/redis';
import { connectDB } from '../db/mongo';
import { loadAccountContextById } from '../services/whatsappAccountService';
import { dispatchTextMessage, dispatchTemplateMessage } from '../whatsapp/dispatch';
import logger from '../utils/logger';
import { QUEUE_NAME } from './whatsappSendQueue';
import {
  markDurableCompleted,
  markDurableFailed,
  markDurableProcessing,
} from '../services/durableQueueJournal';

/**
 * Consumer for the broadcast/delayed-send queue.
 *
 * This is the half of the queue that used to live only on the Express host.
 * Without it, `enqueueBroadcastRecipients` and `enqueueDelayedReply` write
 * jobs into Redis that nothing ever picks up: every broadcast hangs until its
 * five-minute wait times out, and every delayed auto-reply or workflow step is
 * silently never delivered. It runs in this process now (see
 * instrumentation.ts), so the product is one deployment rather than two that
 * must both be up for messaging to work.
 */
export async function processSendJob(job: any) {
  const { accountId, userId, to, messageType, body, templateName, language, components, campaignId, durableId } = job.data;

  if (durableId) await markDurableProcessing(String(durableId));

  try {
    await connectDB();
    const accountContext = await loadAccountContextById(accountId);

    const result = String(messageType).toLowerCase() === 'template'
      ? await dispatchTemplateMessage({ accountContext, userId, to, templateName, language, components, campaignId })
      : await dispatchTextMessage({ accountContext, userId, to, body, campaignId });

    if (durableId) await markDurableCompleted(String(durableId));
    return result;
  } catch (error) {
    if (durableId) await markDurableFailed(String(durableId), error);
    throw error;
  }
}

/**
 * Concurrency is deliberately modest. Meta enforces per-number messaging rate
 * limits, and BullMQ's retry/backoff already absorbs transient failures
 * without needing every recipient sent in parallel.
 */
export function startWhatsAppSendWorker({ concurrency = Number(process.env.SEND_WORKER_CONCURRENCY) || 5 } = {}) {
  const worker = new Worker(QUEUE_NAME, processSendJob, {
    connection: getRedisConnection() as any,
    concurrency,
  });

  worker.on('failed', (job, error) => {
    logger.warn(
      `[whatsapp-send-worker] Job ${job?.id} (recipient ${job?.data?.to}) failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${error.message}`
    );
  });

  worker.on('error', (error) => {
    logger.error('[whatsapp-send-worker] Worker error:', error.message);
  });

  logger.info(`[whatsapp-send-worker] Started (concurrency ${concurrency})`);
  return worker;
}
