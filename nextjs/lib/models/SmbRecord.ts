import mongoose, { Schema } from 'mongoose';

export const SMB_RECORD_KINDS = [
  'lead',
  'followup',
  'quotation',
  'order',
  'invoice',
  'payment',
  'task',
  'expense',
  'vendor',
  'product',
  'inventory',
  'review_request',
  'note',
] as const;

const smbRecordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', default: null, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'SmbRecord', default: null, index: true },
    kind: { type: String, enum: SMB_RECORD_KINDS, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    status: { type: String, default: 'open', trim: true, lowercase: true, index: true },
    stage: { type: String, default: '', trim: true, lowercase: true, index: true },
    source: { type: String, default: '', trim: true, lowercase: true, index: true },
    reference: { type: String, default: '', trim: true },
    assignedTo: { type: String, default: '', trim: true, index: true },
    amountInPaise: { type: Number, default: 0, min: 0 },
    balanceInPaise: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    dueAt: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

smbRecordSchema.pre('save', function normalizeRecord(next) {
  const doc = this as any;
  doc.title = String(doc.title || '').trim();
  doc.status = String(doc.status || 'open').trim().toLowerCase();
  doc.stage = String(doc.stage || '').trim().toLowerCase();
  doc.source = String(doc.source || '').trim().toLowerCase();
  doc.assignedTo = String(doc.assignedTo || '').trim();
  if (!doc.data || typeof doc.data !== 'object' || Array.isArray(doc.data)) doc.data = {};
  if (['completed', 'paid', 'done', 'closed'].includes(doc.status) && !doc.completedAt) doc.completedAt = new Date();
  next();
});

smbRecordSchema.index({ userId: 1, kind: 1, createdAt: -1 });
smbRecordSchema.index({ userId: 1, kind: 1, status: 1, dueAt: 1 });
smbRecordSchema.index({ userId: 1, contactId: 1, createdAt: -1 });
smbRecordSchema.index({ userId: 1, assignedTo: 1, status: 1, dueAt: 1 });

export const SmbRecord = (mongoose.models.SmbRecord as any) || mongoose.model('SmbRecord', smbRecordSchema);
export default SmbRecord;
