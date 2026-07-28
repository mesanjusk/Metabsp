import AuditLog from '../models/AuditLog';
import logger from '../utils/logger';

// Ported from backend/src/services/auditLogService.js. `req` here is
// whatever minimal shape a Route Handler passes (e.g. { ip, headers }) —
// see lib/auth/session.ts for how it's built from the Web Request object.
export async function recordAuditEvent({
  req,
  userId,
  tenantId,
  action,
  resource = '',
  resourceId = '',
  outcome = 'success',
  metadata = {},
}: {
  req?: { user?: { id?: string }; ip?: string; headers?: { get?: (name: string) => string | null } };
  userId?: string | null;
  tenantId?: string | null;
  action: string;
  resource?: string;
  resourceId?: string;
  outcome?: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}) {
  try {
    await AuditLog.create({
      userId: userId || req?.user?.id || null,
      tenantId: tenantId || null,
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : '',
      outcome,
      ipAddress: req?.ip || '',
      userAgent: (req?.headers?.get && req.headers.get('user-agent')) || '',
      metadata,
    });
  } catch (error: any) {
    logger.warn('[audit-log] Failed to record audit event', action, error.message);
  }
}
