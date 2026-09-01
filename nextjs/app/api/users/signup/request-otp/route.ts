import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { User } from '@/lib/models';
import { sendOtp } from '@/lib/services/otpService';
import { checkAuthRateLimit } from '@/lib/http/rateLimit';
import { normalizeAccountMobile, isPlausibleMobile, mobileLookupCandidates } from '@/lib/utils/accountMobile';
import logger from '@/lib/utils/logger';

// Ported from backend/src/routes/Users.js's POST /signup/request-otp, with
// the username dropped: the mobile number is the account identity now, so
// there is nothing else to collect before sending the code.
export async function POST(req: NextRequest) {
  // Guarded: these routes validate and rate-limit before their try block,
  // so an unreachable database would otherwise escape as a bare 500.
  try {
    await connectDB();
  } catch (error) {
    return errorResponse(error, 'Service temporarily unavailable');
  }

  const allowed = await checkAuthRateLimit(req, { windowMs: 15 * 60 * 1000, maxRequests: 5 });
  if (!allowed) {
    return NextResponse.json({ success: false, message: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const mobile = normalizeAccountMobile(body?.Mobile_number);

  if (!mobile) {
    return NextResponse.json({ success: false, message: 'Mobile number is required.' }, { status: 400 });
  }
  if (!isPlausibleMobile(mobile)) {
    return NextResponse.json(
      { success: false, message: 'Enter a valid mobile number, including the country code.' },
      { status: 400 }
    );
  }

  try {
    // Checked against every form the number might already be stored under, so
    // a customer who registered as 9876543210 is not invited to register
    // again as 919876543210.
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

    const result = await sendOtp(mobile, 'SIGNUP');
    return NextResponse.json(
      { success: result.sent, message: result.sent ? 'OTP sent via WhatsApp.' : result.error || 'Could not send OTP via WhatsApp. Please try again later.' },
      { status: result.sent ? 200 : 502 }
    );
  } catch (error: any) {
    logger.error('Signup request-otp error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to send OTP.' }, { status: 500 });
  }
}
