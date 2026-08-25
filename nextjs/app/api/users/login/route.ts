import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { User } from '@/lib/models';
import { signTokenForUser } from '@/lib/auth/jwt';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import { checkAuthRateLimit } from '@/lib/http/rateLimit';
import { sanitizeUser } from '@/lib/http/sanitizeUser';
import logger from '@/lib/utils/logger';

// Ported from backend/src/routes/Users.js's POST /login. Same request/
// response contract (User_name/Password in, {success,token,user} out) so
// the existing frontend's Cloud auth context works against this endpoint
// unchanged. Same rate limit as the original's loginLimiter (20/15min/IP).
export async function POST(req: NextRequest) {
  // Guarded: these routes validate and rate-limit before their try block,
  // so an unreachable database would otherwise escape as a bare 500.
  try {
    await connectDB();
  } catch (error) {
    return errorResponse(error, 'Service temporarily unavailable');
  }

  const allowed = await checkAuthRateLimit(req, { windowMs: 15 * 60 * 1000, maxRequests: 20 });
  if (!allowed) {
    return NextResponse.json({ success: false, message: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

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
