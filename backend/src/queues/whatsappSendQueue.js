const { Queue, QueueEvents } = require('bullmq');
const { getRedisConnection } = require('../config/redis');

const QUEUE_NAME = 'whatsapp-broadcast-send';

let queue = null;
let queueEvents = null;

function getQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 60 * 60 }, // keep 1h for debugging, then drop
        // Failed jobs are kept indefinitely (up to this cap) — this is the
        // dead-letter queue: inspectable via queue.getFailed() rather than a
        // separate Redis structure, since BullMQ already tracks them
        // distinctly from active/completed jobs.
        removeOnFail: { count: 5000 },
      },
    });
  }
  return queue;
}

function getQueueEvents() {
  if (!queueEvents) {
    queueEvents = new QueueEvents(QUEUE_NAME, { connection: getRedisConnection() });
  }
  return queueEvents;
}

// One job per recipient. Job data intentionally carries only accountId (not
// a decrypted access token) — the worker re-resolves the account context
// itself right before sending, so no plaintext token is ever persisted in
// Redis. See src/services/whatsappAccountService.js:loadAccountContextById.
function buildJobData({ accountId, userId, to, messageType, body, templateName, language, components, campaignId }) {
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

async function enqueueBroadcastRecipients({ accountId, userId, recipients, messageType, body, templateName, language, components, campaignId }) {
  const q = getQueue();
  const jobs = recipients.map((to) => ({
    name: 'send',
    data: buildJobData({ accountId, userId, to, messageType, body, templateName, language, components, campaignId }),
  }));
  return q.addBulk(jobs);
}

// Waits for a specific batch of jobs to reach a terminal state (completed or
// failed after exhausting retries), returning per-recipient results in the
// same {recipient, success, error} shape sendBroadcast has always returned —
// preserves the existing response contract the frontend (BulkSender.jsx)
// depends on, while gaining retry/backoff and crash-durability from the
// queue underneath.
async function waitForJobResults(jobs, { timeoutMs = 5 * 60 * 1000 } = {}) {
  const events = getQueueEvents();
  await events.waitUntilReady();

  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        await job.waitUntilFinished(events, timeoutMs);
        return { recipient: job.data.to, success: true };
      } catch (error) {
        return { recipient: job.data.to, success: false, error: error.message };
      }
    })
  );

  return results;
}

async function closeQueue() {
  await queue?.close();
  await queueEvents?.close();
  queue = null;
  queueEvents = null;
}

module.exports = {
  QUEUE_NAME,
  getQueue,
  getQueueEvents,
  enqueueBroadcastRecipients,
  waitForJobResults,
  closeQueue,
};
