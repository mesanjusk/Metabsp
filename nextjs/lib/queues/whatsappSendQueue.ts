import { Queue, QueueEvents } from 'bullmq';
import { getRedisConnection } from '../db/redis';

// Ported from backend/src/queues/whatsappSendQueue.js — PRODUCER SIDE ONLY.
// The consumer (BullMQ Worker) stays on the always-on backend/ host
// (backend/src/queues/whatsappSendWorker.js, unchanged) per
// docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md §0/§2.2 — a Worker long-polls
// Redis and needs a persistent process, which a Vercel function is not.
// Same QUEUE_NAME, same job shape as the original so the unchanged worker
// on the always-on host can process jobs enqueued from here without any
// change on its side.
export const QUEUE_NAME = 'whatsapp-broadcast-send';

let queue: Queue | null = null;
let queueEvents: QueueEvents | null = null;

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 60 * 60 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return queue;
}

function getQueueEvents(): QueueEvents {
  if (!queueEvents) {
    queueEvents = new QueueEvents(QUEUE_NAME, { connection: getRedisConnection() as any });
  }
  return queueEvents;
}

interface JobDataInput {
  accountId: string;
  userId: string;
  to: string;
  messageType: string;
  body?: string;
  templateName?: string;
  language?: string;
  components?: unknown[];
  campaignId?: string;
}

function buildJobData({ accountId, userId, to, messageType, body, templateName, language, components, campaignId }: JobDataInput) {
  return {
    accountId: String(accountId),
    userId: String(userId),
    to,
    messageType,
    body,
    templateName,
    language,
    components,
    campaignId,
  };
}

export async function enqueueBroadcastRecipients({
  accountId,
  userId,
  recipients,
  messageType,
  body,
  templateName,
  language,
  components,
  campaignId,
}: Omit<JobDataInput, 'to'> & { recipients: string[] }) {
  const q = getQueue();
  const jobs = recipients.map((to) => ({
    name: 'send',
    data: buildJobData({ accountId, userId, to, messageType, body, templateName, language, components, campaignId }),
  }));
  return q.addBulk(jobs);
}

// Enqueues a single delayed send — used by the webhook route for
// auto-reply/workflow-step sends that used to be `setTimeout`-scheduled
// in-process (see docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md §0: a bare
// setTimeout cannot be trusted to fire in a Vercel serverless function
// after the response is sent). BullMQ's native per-job `delay` option
// handles this durably: the job sits in Redis until its time arrives, then
// the always-on host's existing Worker (unchanged) picks it up and calls
// dispatchTextMessage/dispatchTemplateMessage exactly as it already does
// for broadcast sends — no new worker/queue needed.
export async function enqueueDelayedReply(data: JobDataInput, delayMs: number) {
  const q = getQueue();
  return q.add('send', buildJobData(data), { delay: Math.max(0, delayMs) });
}

// Waits for a specific batch of jobs to reach a terminal state — same
// contract as the original, used by the (to-be-ported) broadcast endpoint.
export async function waitForJobResults(jobs: any[], { timeoutMs = 5 * 60 * 1000 } = {}) {
  const events = getQueueEvents();
  await events.waitUntilReady();

  return Promise.all(
    jobs.map(async (job) => {
      try {
        await job.waitUntilFinished(events, timeoutMs);
        return { recipient: job.data.to, success: true };
      } catch (error: any) {
        return { recipient: job.data.to, success: false, error: error.message };
      }
    })
  );
}
