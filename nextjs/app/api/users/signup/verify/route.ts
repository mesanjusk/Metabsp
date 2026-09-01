import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { User } from '@/lib/models';
import { verifyOtp } from '@/lib/services/otpService';
import { signTokenForUser } from '@/lib/auth/jwt';
import { getGlobalRoles } from '@/lib/auth/globalRoles';
import { checkAuthRateLimit } from '@/lib/http/rateLimit';
import { sanitizeUser } from '@/lib/http/sanitizeUser';
import { normalizeAccountMobile, isPlausibleMobile, mobileLookupCandidates } from '@/lib/utils/accountMobile';
import logger from '@/lib/utils/logger';

// Ported from backend/src/routes/Users.js's POST /signup/verify.
//
// The account is created under its mobile number: `username` and `mobile`
// hold the same canonical value, so there is exactly one identifier and it is
// the one the OTP was sent to. A display name is optional and cosmetic — it
// never authenticates anything.
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
  const mobile = normalizeAccountMobile(body?.Mobile_number);
  const password = String(body?.Password || '').trim();
  const otpCode = String(body?.code || '').trim();
  const displayName = String(body?.Display_name || '').trim();

  if (!mobile || !password || !otpCode) {
    return NextResponse.json({ success: false, message: 'Mobile number, password and OTP are required.' }, { status: 400 });
  }
  if (!isPlausibleMobile(mobile)) {
    return NextResponse.json(
      { success: false, message: 'Enter a valid mobile number, including the country code.' },
      { status: 400 }
    );
  }

  try {
    const isValid = await verifyOtp(mobile, otpCode, 'SIGNUP');
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Invalid or expired OTP.' }, { status: 400 });
    }

    const existingUser = await User.findOne({
      tenantId: null,
      $or: [{ mobile: { $in: mobileLookupCandidates(mobile) } }, { username: mobile }],
    });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'An account already exists for this mobile number. Sign in instead.' },
        { status: 409 }
      );
    }

    const { userRole } = await getGlobalRoles();
    const user: any = await User.create({
      name: displayName || mobile,
      username: mobile,
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
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: 'An account already exists for this mobile number. Sign in instead.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, message: error.message || 'Failed to create account.' }, { status: 500 });
  }
}
