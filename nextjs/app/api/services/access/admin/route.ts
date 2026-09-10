import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { User } from '@/lib/models';
import { resolveServiceAccess } from '@/lib/services/serviceAccess';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const userId = String(req.nextUrl.searchParams.get('userId') || '').trim();
    if (!userId) return NextResponse.json({ success: false, message: 'userId is required' }, { status: 400 });

    const user: any = await User.findById(userId).populate('roleId');
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

    const permissions: string[] = user.roleId?.permissions || [];
    const access = await resolveServiceAccess({
      id: String(user._id),
      isAdmin: permissions.includes('*'),
      tenantId: user.tenantId ? String(user.tenantId) : null,
      doc: user,
    });

    return NextResponse.json({ success: true, data: access });
  } catch (error) {
    return errorResponse(error, 'Failed to load user service access');
  }
}
