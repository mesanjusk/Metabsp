import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AuditLog from '@/lib/models/AuditLog';
import { auditMongoIndexes, createMissingMongoIndexes } from '@/lib/services/mongoIndexAudit';

export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    requireAdmin(authed);
    const audit = await auditMongoIndexes();
    return NextResponse.json({ success: true, data: audit });
  } catch (error) {
    return errorResponse(error, 'Failed to audit MongoDB indexes');
  }
}

export async function POST(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const body = await req.json().catch(() => ({}));
    if (body?.action !== 'create-missing') {
      return NextResponse.json(
        { success: false, message: 'Set action to "create-missing". Existing indexes are never dropped automatically.' },
        { status: 400 }
      );
    }

    const result = await createMissingMongoIndexes();

    await AuditLog.create({
      userId: authed.doc._id,
      action: 'mongo_indexes.create_missing',
      resource: 'system',
      outcome: result.failures.length ? 'partial' : 'success',
      metadata: {
        createdModels: result.createdModels,
        failures: result.failures,
        remainingMissing: result.after.missingIndexCount,
        dangerousCount: result.after.dangerousCount,
      },
    }).catch(() => undefined);

    return NextResponse.json({ success: result.failures.length === 0, data: result });
  } catch (error) {
    return errorResponse(error, 'Failed to create missing MongoDB indexes');
  }
}
