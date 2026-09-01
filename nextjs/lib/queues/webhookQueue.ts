import { Queue } from 'bullmq';
import { getRedisConnection } from '../db/redis';

/**
 * Inbound Meta webhook envelopes, queued so the HTTP handler can acknowledge
 * Meta immediately (see lib/whatsapp/webhookHandler.ts for why that matters).
 *
 * Jobs carry the raw parsed envelope. Signature verification has already
 * happened in the request handler, so anything on this queue is known to have
 * come from Meta — the worker does not re-verify and must never be fed from
 * anywhere else.
 */
export const WEBHOOK_QUEUE_NAME = 'whatsapp-webhook-inbound';

let queue: Queue | null = null;

export function getWebhookQueue(): Queue {
  if (!queue) {
    queue = new Queue(WEBHOOK_QUEUE_NAME, {
      connection: getRedisConnection() as any,
      defaultJobOptions: {
        // Inbound events are the product's source of truth for a customer
        // conversation; retry harder than an outbound send, whose failure the
        // sender can see and act on.
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 60 * 60, count: 5000 },
        // Kept as an inspectable dead-letter set: a webhook payload that
        // exhausted its retries is a customer message that never landed, and
        // needs to be recoverable by hand.
        removeOnFail: { count: 10000 },
      },
    });
  }
  return queue;
}

export async function enqueueWebhookEnvelope(envelope: unknown) {
  return getWebhookQueue().add('inbound', { envelope });
}

export async function closeWebhookQueue() {
  await queue?.close();
  queue = null;
}
