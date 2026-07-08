const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

// Best-effort, fire-and-forget: a logging failure must never block the
// actual action it's recording (same pattern as tenant provisioning and
// webhook auto-subscription elsewhere in this codebase).
async function recordAuditEvent({ req, userId, tenantId, action, resource = '', resourceId = '', outcome = 'success', metadata = {} }) {
  try {
    await AuditLog.create({
      userId: userId || req?.user?.id || null,
      tenantId: tenantId || null,
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : '',
      outcome,
      ipAddress: req?.ip || '',
      userAgent: req?.headers?.['user-agent'] || '',
      metadata,
    });
  } catch (error) {
    logger.warn('[audit-log] Failed to record audit event', action, error.message);
  }
}

module.exports = { recordAuditEvent };
