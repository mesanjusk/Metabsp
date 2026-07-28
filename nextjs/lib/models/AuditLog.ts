import mongoose, { Schema } from 'mongoose';

// Ported from backend/src/models/AuditLog.js.
const auditLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    action: { type: String, required: true, trim: true, index: true },
    resource: { type: String, default: '', trim: true },
    resourceId: { type: String, default: '', trim: true },
    outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = (mongoose.models.AuditLog as any) || mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
