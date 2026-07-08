const mongoose = require('mongoose');

// Security/admin-relevant action trail — separate from the user-facing
// Notification model. Deliberately schema-loose (metadata: Mixed) since the
// set of auditable actions will grow across both the Cloud and Bulk
// products without needing a migration each time.
const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    action: { type: String, required: true, trim: true, index: true },
    resource: { type: String, default: '', trim: true },
    resourceId: { type: String, default: '', trim: true },
    outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
