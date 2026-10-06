import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../db/mongo';
import SmbRecord from '../models/SmbRecord';

export type DurableQueueKind = 'webhook' | 'whatsapp_send';
export type DurableQueueState = 'pending' | 'queued' | 'processing' | 'completed' | 'failed';

const STORAGE_KIND = 'system_durable_queue';

const COMPLETED_RETENTION_MS = Math.max(
  24 * 60 * 60 * 1000,
  Number(process.env.DURABLE_QUEUE_COMPLETED_RETENTION_DAYS || 14) * 24 * 60 * 60 * 1000
);

export const durableWebhookId = (rawBody: string) =>
  `webhook-${crypto.createHash('sha256').update(rawBody).digest('hex')}`;

export const randomDurableSendId = () => `send-${crypto.randomUUID()}`;

export const stableDurableSendId = (stableKey: string) =>
  `send-${crypto.createHash('sha256').update(stableKey).digest('hex')}`;

// The Atlas database is already at its collection limit. Reuse SmbRecord
// rather than creating another physical Mongo collection. A deterministic
// ObjectId derived from the durable id preserves the same duplicate/race
// protection the standalone model used to provide.
const storageId = (id: string) =>
  new mongoose.Types.ObjectId(crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 24));

const toDurableJob = (record: any) => {
  if (!record) return null;
  const data = record.data || {};
  return {
    _id: String(record.reference || ''),
    storageId: String(record._id),
    kind: data.kind as DurableQueueKind,
    state: String(record.status || 'pending') as DurableQueueState,
    payload: data.payload,
    availableAt: record.dueAt || record.createdAt,
    queuedAt: data.queuedAt || null,
    processingAt: data.processingAt || null,
    completedAt: record.completedAt || null,
    lastAttemptAt: data.lastAttemptAt || null,
    nextAttemptAt: data.nextAttemptAt || null,
    attempts: Number(data.attempts || 0),
    lastError: String(data.lastError || ''),
    cleanupAfter: data.cleanupAfter || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

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

  const _id = storageId(id);
  const existing: any = await SmbRecord.findOne({ _id, kind: STORAGE_KIND }).lean();
  if (existing) return toDurableJob(existing);

  try {
    const created: any = await SmbRecord.create({
      _id,
      userId: null,
      kind: STORAGE_KIND,
      title: kind === 'webhook' ? 'Durable inbound webhook' : 'Durable WhatsApp send',
      status: 'pending',
      source: 'system',
      reference: id,
      dueAt: availableAt,
      data: {
        kind,
        payload,
        attempts: 0,
        lastError: '',
        queuedAt: null,
        processingAt: null,
        lastAttemptAt: null,
        nextAttemptAt: null,
        cleanupAfter: null,
      },
    });
    return toDurableJob(created.toObject());
  } catch (error: any) {
    if (error?.code === 11000) {
      const raced: any = await SmbRecord.findOne({ _id, kind: STORAGE_KIND }).lean();
      return toDurableJob(raced);
    }
    throw error;
  }
}

export async function markDurableQueued(id: string) {
  await connectDB();
  await SmbRecord.updateOne(
    {
      _id: storageId(id),
      kind: STORAGE_KIND,
      status: { $in: ['pending', 'failed', 'queued'] },
    },
    {
      $set: {
        status: 'queued',
        'data.queuedAt': new Date(),
        'data.lastError': '',
        'data.nextAttemptAt': null,
      },
    }
  );
}

export async function markDurableProcessing(id: string) {
  await connectDB();
  await SmbRecord.updateOne(
    { _id: storageId(id), kind: STORAGE_KIND, status: { $ne: 'completed' } },
    {
      $set: {
        status: 'processing',
        'data.processingAt': new Date(),
        'data.lastAttemptAt': new Date(),
      },
      $inc: { 'data.attempts': 1 },
    }
  );
}

export async function markDurableCompleted(id: string) {
  await connectDB();
  await SmbRecord.updateOne(
    { _id: storageId(id), kind: STORAGE_KIND },
    {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        'data.lastError': '',
        'data.nextAttemptAt': null,
        'data.cleanupAfter': new Date(Date.now() + COMPLETED_RETENTION_MS),
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
  await SmbRecord.updateOne(
    { _id: storageId(id), kind: STORAGE_KIND, status: { $ne: 'completed' } },
    {
      $set: {
        status: 'failed',
        'data.lastError': String((error as any)?.message || error || 'Unknown queue processing error').slice(0, 2000),
        'data.nextAttemptAt': new Date(Date.now() + retryDelayMs),
      },
    }
  );
}

const recoverableFilter = ({
  queuedStaleMs = 60 * 1000,
  processingStaleMs = 5 * 60 * 1000,
} = {}) => {
  const now = new Date();
  return {
    kind: STORAGE_KIND,
    dueAt: { $lte: now },
    $or: [
      { status: 'pending' },
      {
        status: 'failed',
        $or: [
          { 'data.nextAttemptAt': null },
          { 'data.nextAttemptAt': { $exists: false } },
          { 'data.nextAttemptAt': { $lte: now } },
        ],
      },
      { status: 'queued', 'data.queuedAt': { $lt: new Date(Date.now() - queuedStaleMs) } },
      { status: 'processing', 'data.processingAt': { $lt: new Date(Date.now() - processingStaleMs) } },
    ],
  };
};

export async function getRecoverableDurableJobs({
  limit = 100,
  queuedStaleMs = 60 * 1000,
  processingStaleMs = 5 * 60 * 1000,
} = {}) {
  await connectDB();
  const rows: any[] = await SmbRecord.find(recoverableFilter({ queuedStaleMs, processingStaleMs }))
    .sort({ dueAt: 1, createdAt: 1 })
    .limit(limit)
    .lean();

  return rows.map(toDurableJob).filter(Boolean);
}

export async function countRecoverableDurableJobs() {
  await connectDB();
  return SmbRecord.countDocuments(recoverableFilter());
}

export async function cleanupDurableQueueJournal() {
  await connectDB();
  const result = await SmbRecord.deleteMany({
    kind: STORAGE_KIND,
    status: 'completed',
    'data.cleanupAfter': { $lte: new Date() },
  });
  return { deleted: result.deletedCount || 0 };
}
