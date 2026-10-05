import mongoose, { Schema } from 'mongoose';

const backupSnapshotSchema = new Schema(
  {
    status: { type: String, enum: ['running', 'success', 'failed'], required: true, index: true },
    startedAt: { type: Date, required: true },
    completedAt: Date,
    publicId: { type: String, default: '' },
    secureUrl: { type: String, default: '' },
    bytes: { type: Number, default: 0 },
    sha256: { type: String, default: '' },
    collectionCount: { type: Number, default: 0 },
    documentCount: { type: Number, default: 0 },
    error: { type: String, default: '' },
    formatVersion: { type: Number, default: 1 },
    remoteVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

backupSnapshotSchema.index({ status: 1, completedAt: -1 });

export const BackupSnapshot =
  (mongoose.models.BackupSnapshot as any) ||
  mongoose.model('BackupSnapshot', backupSnapshotSchema);

export default BackupSnapshot;
