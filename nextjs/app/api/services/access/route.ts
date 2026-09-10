import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { ServiceEntitlement } from '@/lib/models';
import { resolveServiceAccess, SERVICE_SLUGS } from '@/lib/services/serviceAccess';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const services = await resolveServiceAccess(authed);
    return NextResponse.json({ success: true, data: services });
  } catch (error) {
    return errorResponse(error, 'Failed to load service access');
  }
}

/**
 * Admin-only entitlement writer. This is intentionally generic so the future
 * Billing/Admin screens can grant either a whole business or one staff member
 * without changing the access model again.
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const body = await req.json();
    const service = String(body?.service || '').trim().toLowerCase();
    if (!(SERVICE_SLUGS as readonly string[]).includes(service)) {
      return NextResponse.json({ success: false, message: 'Unknown service' }, { status: 400 });
    }

    const targetUserId = body?.userId ? String(body.userId) : null;
    const targetTenantId = body?.tenantId ? String(body.tenantId) : authed.tenantId;
    if (!targetUserId && !targetTenantId) {
      return NextResponse.json({ success: false, message: 'tenantId or userId is required' }, { status: 400 });
    }

    const filter = {
      tenantId: targetTenantId || null,
      userId: targetUserId || null,
      service,
    };

    const entitlement = await ServiceEntitlement.findOneAndUpdate(
      filter,
      {
        $set: {
          enabled: Boolean(body?.enabled),
          source: body?.source || 'manual',
          startsAt: body?.startsAt || null,
          endsAt: body?.endsAt || null,
          note: String(body?.note || ''),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({ success: true, data: entitlement });
  } catch (error) {
    return errorResponse(error, 'Failed to update service access');
  }
}
