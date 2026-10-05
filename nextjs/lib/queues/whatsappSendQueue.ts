import { Queue, QueueEvents } from 'bullmq';
import { getRedisConnection } from '../db/redis';
import {
  ensureDurableQueueJob,
  markDurableQueued,
  randomDurableSendId,
  stableDurableSendId,
} from '../services/durableQueueJournal';

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

export class DurableQueuePendingError extends Error {
  code = 'DURABLE_QUEUE_PENDING';
  durableIds: string[];

  constructor(message: string, durableIds: string[]) {
    super(message);
    this.name = 'DurableQueuePendingError';
    this.durableIds = durableIds;
  }
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
  const stableCampaignKey = campaignId
    ? [String(accountId), String(userId), String(campaignId)].join('_').replace(/[^a-zA-Z0-9_-]/g, '')
    : '';

  const prepared = await Promise.all(
    recipients.map(async (to, index) => {
      const data = buildJobData({ accountId, userId, to, messageType, body, templateName, language, components, campaignId });
      const stableKey = stableCampaignKey
        ? `${stableCampaignKey}|${index}|${String(to).replace(/[^0-9]/g, '')}`
        : `${String(accountId)}|${String(userId)}|${Date.now()}|${index}|${to}`;
      const durableId = stableCampaignKey ? stableDurableSendId(stableKey) : randomDurableSendId();
      const journal: any = await ensureDurableQueueJob({
        id: durableId,
        kind: 'whatsapp_send',
        payload: data,
        availableAt: new Date(),
      });
      return { data, durableId, completed: journal?.state === 'completed' };
    })
  );

  const alreadyCompleted = prepared.filter((item) => item.completed);
  const pending = prepared.filter((item) => !item.completed);
  if (!pending.length) {
    return alreadyCompleted.map((item) => ({
      id: item.durableId,
      data: item.data,
      durableCompleted: true,
      waitUntilFinished: async () => ({ durableCompleted: true }),
    }));
  }

  const jobs = pending.map((item) => ({
    name: 'send',
    data: { ...item.data, durableId: item.durableId },
    opts: { jobId: item.durableId },
  }));

  try {
    const queued = await q.addBulk(jobs);
    await Promise.all(pending.map((item) => markDurableQueued(item.durableId)));
    return [
      ...alreadyCompleted.map((item) => ({
        id: item.durableId,
        data: item.data,
        durableCompleted: true,
        waitUntilFinished: async () => ({ durableCompleted: true }),
      })),
      ...queued,
    ];
  } catch (error: any) {
    // Mongo already owns a durable copy of every intended send. Surface an
    // explicit "accepted for retry" condition so an immediate broadcast can
    // tell the user it is pending instead of reporting a hard failure while a
    // background replay later sends unexpectedly.
    throw new DurableQueuePendingError(
      `Redis is temporarily unavailable; ${pending.length} send(s) are safely journaled for retry`,
      pending.map((item) => item.durableId)
    );
  }
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
  const payload = buildJobData(data);
  const durableId = randomDurableSendId();
  const delay = Math.max(0, delayMs);
  const availableAt = new Date(Date.now() + delay);

  await ensureDurableQueueJob({
    id: durableId,
    kind: 'whatsapp_send',
    payload,
    availableAt,
  });

  try {
    const job = await q.add(
      'send',
      { ...payload, durableId },
      { jobId: durableId, delay }
    );
    await markDurableQueued(durableId);
    return job;
  } catch (error: any) {
    // The Mongo row is enough to guarantee later delivery. Returning a small
    // pending object keeps workflow/auto-reply processing successful while the
    // replay scheduler waits for Redis to recover.
    return { id: durableId, data: payload, durablePending: true, error: error?.message || String(error) };
  }
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
