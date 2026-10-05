import mongoose, { Schema } from 'mongoose';

export type DurableQueueKind = 'webhook' | 'whatsapp_send';
export type DurableQueueState = 'pending' | 'queued' | 'processing' | 'completed' | 'failed';

const durableQueueJobSchema = new Schema(
  {
    _id: { type: String, required: true },
    kind: { type: String, enum: ['webhook', 'whatsapp_send'], required: true, index: true },
    state: {
      type: String,
      enum: ['pending', 'queued', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    payload: { type: Schema.Types.Mixed, required: true },
    availableAt: { type: Date, default: Date.now, index: true },
    queuedAt: Date,
    processingAt: Date,
    completedAt: Date,
    lastAttemptAt: Date,
    nextAttemptAt: Date,
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    // Completed jobs are retained long enough for incident review and
    // idempotency, then removed by the durable-queue cleanup scheduler.
    cleanupAfter: Date,
  },
  { timestamps: true, _id: false }
);

durableQueueJobSchema.index({ kind: 1, state: 1, availableAt: 1 });
durableQueueJobSchema.index({ state: 1, nextAttemptAt: 1 });
durableQueueJobSchema.index({ cleanupAfter: 1 });

export const DurableQueueJob =
  (mongoose.models.DurableQueueJob as any) ||
  mongoose.model('DurableQueueJob', durableQueueJobSchema);

export default DurableQueueJob;
