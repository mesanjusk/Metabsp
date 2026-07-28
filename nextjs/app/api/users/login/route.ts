import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { User } from '@/lib/models';
import { signTokenForUser } from '@/lib/auth/jwt';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import logger from '@/lib/utils/logger';

// Ported from backend/src/routes/Users.js's POST /login. Same request/
// response contract (User_name/Password in, {success,token,user} out) so
// the existing frontend's Cloud auth context works against this endpoint
// unchanged. Rate limiting (loginLimiter, 20/15min/IP in the Express
// version) is not yet ported here — see nextjs/STATUS.md.
const isAdminRole = (user: any) => Array.isArray(user?.roleId?.permissions) && user.roleId.permissions.includes('*');

const sanitizeUser = (userDoc: any) => {
  if (!userDoc) return null;
  return {
    id: String(userDoc._id),
    User_name: userDoc.username,
    User_group: isAdminRole(userDoc) ? 'admin' : 'user',
    Mobile_number: userDoc.mobile || '',
    Whatsapp_provider: userDoc.whatsappProviderPreference || '',
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
};

export async function POST(req: NextRequest) {
  await connectDB();

  const body = await req.json().catch(() => ({}));
  const { User_name, Password } = body || {};
  const normalizedUserName = String(User_name || '').trim();

  if (!normalizedUserName || !Password) {
    return NextResponse.json({ success: false, message: 'User_name and Password are required' }, { status: 400 });
  }

  try {
    const user: any = await User.findOne({ username: normalizedUserName, tenantId: null }).populate('roleId');
    if (!user || !(await user.matchPassword(Password))) {
      recordAuditEvent({ req: req as any, action: 'login', resource: 'user', outcome: 'failure', metadata: { username: normalizedUserName } });
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }
    if (!user.isActive) {
      recordAuditEvent({
        req: req as any,
        userId: user._id,
        action: 'login',
        resource: 'user',
        resourceId: user._id,
        outcome: 'failure',
        metadata: { reason: 'inactive' },
      });
      return NextResponse.json({ success: false, message: 'Account is inactive' }, { status: 403 });
    }

    const token = signTokenForUser(user._id);
    recordAuditEvent({ req: req as any, userId: user._id, action: 'login', resource: 'user', resourceId: user._id, outcome: 'success' });
    return NextResponse.json({ success: true, token, user: sanitizeUser(user) }, { status: 200 });
  } catch (error: any) {
    logger.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'Login failed' }, { status: 500 });
  }
}
