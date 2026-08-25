import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { User } from '@/lib/models';
import { verifyOtp } from '@/lib/services/otpService';
import { signTokenForUser } from '@/lib/auth/jwt';
import { getGlobalRoles } from '@/lib/auth/globalRoles';
import { checkAuthRateLimit } from '@/lib/http/rateLimit';
import { sanitizeUser } from '@/lib/http/sanitizeUser';
import logger from '@/lib/utils/logger';

// Ported from backend/src/routes/Users.js's POST /signup/verify.
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
  const userName = String(body?.User_name || '').trim();
  const mobile = String(body?.Mobile_number || '').trim();
  const password = String(body?.Password || '').trim();
  const otpCode = String(body?.code || '').trim();

  if (!userName || !mobile || !password || !otpCode) {
    return NextResponse.json({ success: false, message: 'All fields are required.' }, { status: 400 });
  }

  try {
    const isValid = await verifyOtp(mobile, otpCode, 'SIGNUP');
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Invalid or expired OTP.' }, { status: 400 });
    }

    const existingUser = await User.findOne({ tenantId: null, $or: [{ username: userName }, { mobile }] });
    if (existingUser) {
      return NextResponse.json({ success: false, message: 'An account with this username or mobile number already exists.' }, { status: 409 });
    }

    const { userRole } = await getGlobalRoles();
    const user: any = await User.create({
      name: userName,
      username: userName,
      password,
      mobile,
      roleId: userRole._id,
      tenantId: null,
      isActive: true,
    });

    const token = signTokenForUser(user._id);
    return NextResponse.json({ success: true, token, user: sanitizeUser(await user.populate('roleId')) }, { status: 201 });
  } catch (error: any) {
    logger.error('Signup verify error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to create account.' }, { status: 500 });
  }
}
