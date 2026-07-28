import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { User } from '@/lib/models';
import { sendOtp } from '@/lib/services/otpService';
import { checkAuthRateLimit } from '@/lib/http/rateLimit';
import logger from '@/lib/utils/logger';

const RESERVED_USERNAME = 'admin';

// Ported from backend/src/routes/Users.js's POST /signup/request-otp.
export async function POST(req: NextRequest) {
  await connectDB();

  const allowed = await checkAuthRateLimit(req, { windowMs: 15 * 60 * 1000, maxRequests: 5 });
  if (!allowed) {
    return NextResponse.json({ success: false, message: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const userName = String(body?.User_name || '').trim();
  const mobile = String(body?.Mobile_number || '').trim();

  if (!userName || !mobile) {
    return NextResponse.json({ success: false, message: 'User name and mobile number are required.' }, { status: 400 });
  }
  if (userName.toLowerCase() === RESERVED_USERNAME) {
    return NextResponse.json({ success: false, message: 'This username is reserved.' }, { status: 400 });
  }

  try {
    const existingUser = await User.findOne({ tenantId: null, $or: [{ username: userName }, { mobile }] });
    if (existingUser) {
      return NextResponse.json({ success: false, message: 'An account with this username or mobile number already exists.' }, { status: 409 });
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
