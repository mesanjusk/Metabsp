import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { User } from '@/lib/models';
import { verifyOtp } from '@/lib/services/otpService';
import { checkAuthRateLimit } from '@/lib/http/rateLimit';
import logger from '@/lib/utils/logger';

// Ported from backend/src/routes/Users.js's POST /forgot-password/reset.
export async function POST(req: NextRequest) {
  // Guarded: these routes validate and rate-limit before their try block,
  // so an unreachable database would otherwise escape as a bare 500.
  try {
    await connectDB();
  } catch (error) {
    return errorResponse(error, 'Service temporarily unavailable');
  }

  const allowed = await checkAuthRateLimit(req, { windowMs: 15 * 60 * 1000, maxRequests: 10 });
  if (!allowed) {
    return NextResponse.json({ success: false, message: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const mobile = String(body?.Mobile_number || '').trim();
  const otpCode = String(body?.code || '').trim();
  const newPassword = String(body?.newPassword || '').trim();

  if (!mobile || !otpCode || !newPassword) {
    return NextResponse.json({ success: false, message: 'All fields are required.' }, { status: 400 });
  }

  try {
    const isValid = await verifyOtp(mobile, otpCode, 'RESET');
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Invalid or expired OTP.' }, { status: 400 });
    }

    const user: any = await User.findOne({ tenantId: null, mobile });
    if (!user) {
      return NextResponse.json({ success: false, message: 'No account found with this mobile number.' }, { status: 404 });
    }

    user.password = newPassword;
    await user.save();

    return NextResponse.json({ success: true, message: 'Password reset successful. Please log in.' }, { status: 200 });
  } catch (error: any) {
    logger.error('Forgot-password reset error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to reset password.' }, { status: 500 });
  }
}
