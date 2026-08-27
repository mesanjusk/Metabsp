import { Worker } from 'bullmq';
import { getRedisConnection } from '../db/redis';
import { loadAccountContextById } from '../services/whatsappAccountService';
import { dispatchTextMessage, dispatchTemplateMessage } from '../whatsapp/dispatch';
import logger from '../utils/logger';
import { QUEUE_NAME } from './whatsappSendQueue';

// Ported from backend/src/queues/whatsappSendWorker.js — the CONSUMER side.
//
// whatsappSendQueue.ts has always been able to enqueue from here; nothing
// consumed those jobs on this host, because the Worker lived on the Express
// service. Every broadcast recipient and every delayed auto-reply/workflow
// step goes through this queue, so with the Express host retired and no worker
// here, jobs would pile up in Redis and no message would ever be sent — with
// no error anywhere, because enqueueing succeeds.
//
// A Worker long-polls Redis and needs a persistent process. server.js provides
// exactly that, which is what running on Render buys over serverless.

export async function processSendJob(job: any) {
  const { accountId, userId, to, messageType, body, templateName, language, components, campaignId } = job.data;

  const accountContext = await loadAccountContextById(accountId);

  if (String(messageType).toLowerCase() === 'template') {
    return dispatchTemplateMessage({ accountContext, userId, to, templateName, language, components, campaignId } as any);
  }
  return dispatchTextMessage({ accountContext, userId, to, body, campaignId } as any);
}

// Concurrency is deliberately modest. Meta enforces per-number messaging rate
// limits, and BullMQ's retry/backoff already covers transient failures, so
// sending every recipient in parallel buys nothing but throttling.
export function startWhatsAppSendWorker({ concurrency = 5 }: { concurrency?: number } = {}) {
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
    logger.error(`[whatsapp-send-worker] Worker error: ${error.message}`);
  });

  return worker;
}
