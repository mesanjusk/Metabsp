import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { sanitizeUser } from '@/lib/http/sanitizeUser';
import { User } from '@/lib/models';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { getGlobalRoles } from '@/lib/auth/globalRoles';
import { assertPhoneNumberAvailable, sanitizeAccount } from '@/lib/services/whatsappAccountService';
import { normalizeAccountMobile, isPlausibleMobile, mobileLookupCandidates } from '@/lib/utils/accountMobile';
import { encryptSensitiveValue } from '@/lib/utils/crypto';
import logger from '@/lib/utils/logger';

// Ported from backend/src/routes/Users.js's GET and POST /manage.
//
// This was the last unported route, and its absence was visible: the
// dashboard's admin Settings tab calls it, got Next.js's HTML 404 page back,
// and rendered the whole document into the panel as an error message.

// The seeded platform administrator signs in under this username. Nothing
// creates username accounts any more, but an admin must not be able to mint a
// second account that shadows it.
const RESERVED_USERNAME = 'admin';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const users: any[] = await User.find({ tenantId: null })
      .populate('roleId')
      .sort({ createdAt: -1 })
      .lean();

    const userIds = users.map((user) => user._id);
    const accounts: any[] = await WhatsAppAccount.find({ userId: { $in: userIds } })
      .sort({ updatedAt: -1 })
      .lean();

    // An active account wins over a stale one for the same user; otherwise the
    // most recently updated (the sort above) is kept.
    const accountByUserId = new Map<string, any>();
    for (const account of accounts) {
      const key = String(account.userId);
      if (!accountByUserId.has(key) || account.isActive) accountByUserId.set(key, account);
    }

    return NextResponse.json({
      success: true,
      items: users.map((user) => ({
        ...sanitizeUser(user),
        whatsappAccount: sanitizeAccount(accountByUserId.get(String(user._id))),
      })),
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load users');
  }
}

export async function POST(req: NextRequest) {
  let session: any = null;
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const body = await req.json().catch(() => ({}));
    const { Password, Mobile_number = '', Display_name = '', User_group = 'user', whatsapp = {} } = body || {};

    const mobile = normalizeAccountMobile(Mobile_number);
    const displayName = String(Display_name || '').trim();
    const normalizedPassword = String(Password || '').trim();

    if (!mobile || !normalizedPassword) {
      return NextResponse.json({ success: false, message: 'Mobile number and password are required.' }, { status: 400 });
    }
    if (!isPlausibleMobile(mobile)) {
      return NextResponse.json(
        { success: false, message: 'Enter a valid mobile number, including the country code.' },
        { status: 400 }
      );
    }
    if (mobile.toLowerCase() === RESERVED_USERNAME) {
      return NextResponse.json({ success: false, message: 'This identifier is reserved.' }, { status: 400 });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const existingUser = await User.findOne({
      tenantId: null,
      $or: [{ mobile: { $in: mobileLookupCandidates(mobile) } }, { username: mobile }],
    }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ success: false, message: 'An account already exists for this mobile number.' }, { status: 409 });
    }

    const { adminRole, userRole } = await getGlobalRoles();
    const roleId = String(User_group || 'user').toLowerCase() === 'admin' ? adminRole._id : userRole._id;

    const createdUsers: any[] = await User.create(
      [{
        name: displayName || mobile,
        username: mobile,
        password: normalizedPassword,
        mobile,
        roleId,
        tenantId: null,
        isActive: true,
      }],
      { session }
    );

    const user: any = await User.findById(createdUsers[0]._id).populate('roleId').session(session);

    const accessToken = String(whatsapp?.accessToken || '').trim();
    const phoneNumberId = String(whatsapp?.phoneNumberId || '').trim();
    const businessAccountId = String(whatsapp?.businessAccountId || '').trim();
    const wabaId = String(whatsapp?.wabaId || businessAccountId).trim();

    let account: any = null;
    if (accessToken && phoneNumberId && (businessAccountId || wabaId)) {
      await assertPhoneNumberAvailable({ phoneNumberId, userId: user._id });
      account = await WhatsAppAccount.findOneAndUpdate(
        { userId: user._id, phoneNumberId },
        {
          $set: {
            userId: user._id,
            accountKey: '',
            connectionMode: 'manual',
            phoneNumberId,
            businessAccountId: businessAccountId || wabaId,
            wabaId: wabaId || businessAccountId,
            displayPhoneNumber: String(whatsapp?.displayPhoneNumber || '').trim(),
            verifiedName: String(whatsapp?.verifiedName || '').trim(),
            accessTokenEncrypted: encryptSensitiveValue(accessToken),
            tokenType: 'Bearer',
            status: 'active',
            webhookSubscribed: Boolean(whatsapp?.webhookSubscribed),
            isActive: true,
            numberClaimed: true,
            connectedAt: new Date(),
            lastSyncAt: new Date(),
            metadata: { createdByAdmin: true },
          },
        },
        { upsert: true, new: true, session }
      );
    }

    await session.commitTransaction();
    session.endSession();
    session = null;

    return NextResponse.json(
      {
        success: true,
        message: 'User created successfully.',
        item: { ...sanitizeUser(user), whatsappAccount: sanitizeAccount(account) },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (session) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
    }
    logger.error('Create user error:', error?.message);
    if (error?.statusCode === 409 || error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: error.message || 'This WhatsApp number is already connected to a different account.' },
        { status: 409 }
      );
    }
    return errorResponse(error, 'Failed to create user.');
  }
}
