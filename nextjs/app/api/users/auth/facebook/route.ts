import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { checkAuthRateLimit } from '@/lib/http/rateLimit';
import { completeSocialLogin } from '@/lib/http/completeSocialLogin';
import { verifyFacebookAccessToken } from '@/lib/services/socialAuthService';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import logger from '@/lib/utils/logger';

// Ported from backend/src/routes/Users.js's POST /auth/facebook.
// Same rate limit as the original's loginLimiter (20 per 15 minutes).
export async function POST(req: NextRequest) {
  try {
    await connectDB();
  } catch (error) {
    return errorResponse(error, 'Service temporarily unavailable');
  }

  const allowed = await checkAuthRateLimit(req, { windowMs: 15 * 60 * 1000, maxRequests: 20 });
  if (!allowed) {
    return NextResponse.json(
      { success: false, message: 'Too many attempts. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const profile = await verifyFacebookAccessToken(String(body?.accessToken || ''));
    return await completeSocialLogin({ req, profile, provider: 'facebook' });
  } catch (error: any) {
    const status =
      Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode <= 599
        ? error.statusCode
        : 500;
    if (status >= 500) logger.error('Facebook sign-in error:', error?.message);
    recordAuditEvent({
      req: req as any,
      action: 'login',
      resource: 'user',
      outcome: 'failure',
      metadata: { provider: 'facebook' },
    });
    return NextResponse.json(
      { success: false, message: error?.message || 'Facebook sign-in failed' },
      { status }
    );
  }
}
