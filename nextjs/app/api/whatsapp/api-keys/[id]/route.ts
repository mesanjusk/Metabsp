import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import AppError from '@/lib/utils/AppError';
import ApiKey from '@/lib/models/ApiKey';

// Revoke marks the key inactive rather than deleting it, so the audit trail and
// lastUsedAt survive. Scoped by userId in the query, so another user's key id
// simply matches nothing.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const revoked = await ApiKey.findOneAndUpdate(
      { _id: id, userId: authed.id },
      { isActive: false },
      { new: true }
    );
    // The Express version answered 200 even when nothing matched, which made a
    // wrong id look like a successful revoke.
    if (!revoked) throw new AppError('API key not found', 404);

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'api_key.revoke',
      resource: 'api_key',
      resourceId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to revoke API key');
  }
}
