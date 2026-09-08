import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { sanitizeUser } from '@/lib/http/sanitizeUser';
import { User } from '@/lib/models';
import { isPlausibleMobile, mobileLookupCandidates, normalizeAccountMobile } from '@/lib/utils/accountMobile';

// Ported from backend/src/routes/Users.js's GET /me.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    return NextResponse.json({ success: true, user: sanitizeUser(authed.doc) }, { status: 200 });
  } catch (error) {
    return errorResponse(error, 'Failed to load user');
  }
}

/**
 * Self-service profile update.
 *
 * Older accounts predate mobile-as-identity and can contain a legacy username,
 * a formatted mobile number, or even an empty mobile field. Every submitted
 * value is therefore normalised defensively — never call .trim() on a value
 * that may be missing — and a successful mobile edit migrates the account to
 * the same canonical identity used by current signup/login.
 */
export async function PUT(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const user: any = await User.findById(authed.id).populate('roleId');

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const mobileProvided = body?.Mobile_number !== undefined;
    const displayNameProvided = body?.Display_name !== undefined;
    const passwordProvided = body?.Password !== undefined && String(body?.Password ?? '').length > 0;

    if (mobileProvided) {
      const submitted = String(body?.Mobile_number ?? '').trim();
      if (!submitted) {
        return NextResponse.json({ success: false, message: 'Mobile number is required.' }, { status: 400 });
      }

      const mobile = normalizeAccountMobile(submitted);
      if (!isPlausibleMobile(mobile)) {
        return NextResponse.json(
          { success: false, message: 'Enter a valid mobile number, including the country code.' },
          { status: 400 }
        );
      }

      const candidates = mobileLookupCandidates(submitted);
      const conflict = await User.findOne({
        _id: { $ne: user._id },
        $or: [{ mobile: { $in: candidates } }, { username: { $in: candidates } }],
      })
        .select('_id')
        .lean();

      if (conflict) {
        return NextResponse.json(
          { success: false, message: 'Another account already uses this mobile number.' },
          { status: 409 }
        );
      }

      user.mobile = mobile;
      // Keep only the deliberately seeded admin login as a legacy username.
      // Every normal/pre-existing customer migrates to the same mobile identity
      // used by new accounts, without changing their user id or workspace data.
      if (String(user.username ?? '').trim().toLowerCase() !== 'admin') {
        user.username = mobile;
      }
      if (!String(user.name ?? '').trim()) user.name = mobile;
    }

    if (displayNameProvided) {
      const displayName = String(body?.Display_name ?? '').trim();
      user.name = displayName || String(user.mobile ?? user.username ?? '').trim();
    }

    if (passwordProvided) {
      const password = String(body?.Password ?? '');
      const confirmPassword = String(body?.Confirm_password ?? '');
      if (confirmPassword && password !== confirmPassword) {
        return NextResponse.json(
          { success: false, message: 'New password and confirmation do not match.' },
          { status: 400 }
        );
      }
      user.password = password;
    }

    if (!mobileProvided && !displayNameProvided && !passwordProvided) {
      return NextResponse.json({ success: false, message: 'No account changes were supplied.' }, { status: 400 });
    }

    await user.save();
    await user.populate('roleId');

    return NextResponse.json(
      { success: true, message: 'Account updated successfully.', user: sanitizeUser(user) },
      { status: 200 }
    );
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: 'Another account already uses this mobile number.' },
        { status: 409 }
      );
    }
    return errorResponse(error, 'Failed to update account');
  }
}
