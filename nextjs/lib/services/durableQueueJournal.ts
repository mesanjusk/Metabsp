import crypto from 'crypto';
import { connectDB } from '../db/mongo';
import DurableQueueJob, { type DurableQueueKind } from '../models/DurableQueueJob';

const COMPLETED_RETENTION_MS = Math.max(
  24 * 60 * 60 * 1000,
  Number(process.env.DURABLE_QUEUE_COMPLETED_RETENTION_DAYS || 14) * 24 * 60 * 60 * 1000
);

export const durableWebhookId = (rawBody: string) =>
  `webhook-${crypto.createHash('sha256').update(rawBody).digest('hex')}`;

export const randomDurableSendId = () => `send-${crypto.randomUUID()}`;

export const stableDurableSendId = (stableKey: string) =>
  `send-${crypto.createHash('sha256').update(stableKey).digest('hex')}`;

export async function ensureDurableQueueJob({
  id,
  kind,
  payload,
  availableAt = new Date(),
}: {
  id: string;
  kind: DurableQueueKind;
  payload: unknown;
  availableAt?: Date;
}) {
  await connectDB();

  const existing: any = await DurableQueueJob.findById(id).lean();
  if (existing) return existing;

  try {
    return await DurableQueueJob.create({
      _id: id,
      kind,
      state: 'pending',
      payload,
      availableAt,
    });
  } catch (error: any) {
    // Two Meta retries or scheduler replicas can race the first insert. The
    // deterministic _id turns that race into a harmless re-read.
    if (error?.code === 11000) {
      return DurableQueueJob.findById(id).lean();
    }
    throw error;
  }
}

export async function markDurableQueued(id: string) {
  await connectDB();
  await DurableQueueJob.updateOne(
    { _id: id, state: { $in: ['pending', 'failed', 'queued'] } },
    {
      $set: { state: 'queued', queuedAt: new Date(), lastError: '', nextAttemptAt: null },
    }
  );
}

export async function markDurableProcessing(id: string) {
  await connectDB();
  await DurableQueueJob.updateOne(
    { _id: id, state: { $ne: 'completed' } },
    {
      $set: { state: 'processing', processingAt: new Date(), lastAttemptAt: new Date() },
      $inc: { attempts: 1 },
    }
  );
}

export async function markDurableCompleted(id: string) {
  await connectDB();
  await DurableQueueJob.updateOne(
    { _id: id },
    {
      $set: {
        state: 'completed',
        completedAt: new Date(),
        lastError: '',
        nextAttemptAt: null,
        cleanupAfter: new Date(Date.now() + COMPLETED_RETENTION_MS),
      },
    }
  );
}

export async function markDurableFailed(
  id: string,
  error: unknown,
  { retryDelayMs = 5 * 60 * 1000 } = {}
) {
  await connectDB();
  await DurableQueueJob.updateOne(
    { _id: id, state: { $ne: 'completed' } },
    {
      $set: {
        state: 'failed',
        lastError: String((error as any)?.message || error || 'Unknown queue processing error').slice(0, 2000),
        nextAttemptAt: new Date(Date.now() + retryDelayMs),
      },
    }
  );
}

export async function getRecoverableDurableJobs({
  limit = 100,
  queuedStaleMs = 60 * 1000,
  processingStaleMs = 5 * 60 * 1000,
} = {}) {
  await connectDB();
  const now = new Date();
  return DurableQueueJob.find({
    availableAt: { $lte: now },
    $or: [
      { state: 'pending' },
      { state: 'failed', $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }] },
      { state: 'queued', queuedAt: { $lt: new Date(Date.now() - queuedStaleMs) } },
      { state: 'processing', processingAt: { $lt: new Date(Date.now() - processingStaleMs) } },
    ],
  })
    .sort({ availableAt: 1, createdAt: 1 })
    .limit(limit)
    .lean();
}

export async function cleanupDurableQueueJournal() {
  await connectDB();
  const result = await DurableQueueJob.deleteMany({
    state: 'completed',
    cleanupAfter: { $lte: new Date() },
  });
  return { deleted: result.deletedCount || 0 };
}
