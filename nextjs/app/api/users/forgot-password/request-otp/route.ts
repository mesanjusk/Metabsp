import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { User } from '@/lib/models';
import { sendOtp } from '@/lib/services/otpService';
import { checkAuthRateLimit } from '@/lib/http/rateLimit';
import logger from '@/lib/utils/logger';

// Ported from backend/src/routes/Users.js's POST /forgot-password/request-otp.
export async function POST(req: NextRequest) {
  await connectDB();

  const allowed = await checkAuthRateLimit(req, { windowMs: 15 * 60 * 1000, maxRequests: 5 });
  if (!allowed) {
    return NextResponse.json({ success: false, message: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const mobile = String(body?.Mobile_number || '').trim();

  if (!mobile) {
    return NextResponse.json({ success: false, message: 'Mobile number is required.' }, { status: 400 });
  }

  try {
    const user = await User.findOne({ tenantId: null, mobile });
    if (!user) {
      return NextResponse.json({ success: false, message: 'No account found with this mobile number.' }, { status: 404 });
    }

    const result = await sendOtp(mobile, 'RESET');
    return NextResponse.json(
      { success: result.sent, message: result.sent ? 'OTP sent via WhatsApp.' : result.error || 'Could not send OTP via WhatsApp. Please try again later.' },
      { status: result.sent ? 200 : 502 }
    );
  } catch (error: any) {
    logger.error('Forgot-password request-otp error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to send OTP.' }, { status: 500 });
  }
}
