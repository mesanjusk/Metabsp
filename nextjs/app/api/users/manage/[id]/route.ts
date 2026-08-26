import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { sanitizeUser } from '@/lib/http/sanitizeUser';
import { User } from '@/lib/models';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { getGlobalRoles } from '@/lib/auth/globalRoles';
import { assertPhoneNumberAvailable, sanitizeAccount } from '@/lib/services/whatsappAccountService';
import { encryptSensitiveValue } from '@/lib/utils/crypto';
import logger from '@/lib/utils/logger';

// Ported from backend/src/routes/Users.js's PUT /manage/:id.
const RESERVED_USERNAME = 'admin';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { User_name, Password, Mobile_number = '', User_group = 'user', whatsapp = {} } = body || {};

    const user: any = await User.findById(id).populate('roleId');
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const normalizedUserName = String(User_name || user.username).trim();
    if (!normalizedUserName) {
      return NextResponse.json({ success: false, message: 'User name is required.' }, { status: 400 });
    }
    if (normalizedUserName.toLowerCase() === RESERVED_USERNAME) {
      return NextResponse.json({ success: false, message: 'This username is reserved.' }, { status: 400 });
    }

    const conflictUser = await User.findOne({
      username: normalizedUserName,
      tenantId: null,
      _id: { $ne: user._id },
    }).lean();
    if (conflictUser) {
      return NextResponse.json({ success: false, message: 'User name already exists.' }, { status: 409 });
    }

    const { adminRole, userRole } = await getGlobalRoles();

    user.username = normalizedUserName;
    user.name = normalizedUserName;
    user.mobile = String(Mobile_number || '').trim();
    user.roleId = String(User_group || 'user').toLowerCase() === 'admin' ? adminRole._id : userRole._id;
    if (String(Password || '').trim()) user.password = String(Password).trim();
    await user.save();
    await user.populate('roleId');

    const accessToken = String(whatsapp?.accessToken || '').trim();
    const phoneNumberId = String(whatsapp?.phoneNumberId || '').trim();
    const businessAccountId = String(whatsapp?.businessAccountId || '').trim();
    const wabaId = String(whatsapp?.wabaId || businessAccountId).trim();

    let account: any = await WhatsAppAccount.findOne({ userId: user._id, isActive: true }).sort({ updatedAt: -1 });
    if (!account && phoneNumberId) {
      account = await WhatsAppAccount.findOne({ userId: user._id, phoneNumberId });
    }

    if (accessToken && phoneNumberId && (businessAccountId || wabaId)) {
      if (!account || phoneNumberId !== account.phoneNumberId) {
        await assertPhoneNumberAvailable({ phoneNumberId, userId: user._id, excludeAccountId: account?._id });
      }
      if (!account) {
        account = new WhatsAppAccount({
          userId: user._id,
          phoneNumberId,
          accessTokenEncrypted: encryptSensitiveValue(accessToken),
        });
      }
      account.connectionMode = 'manual';
      account.phoneNumberId = phoneNumberId;
      account.businessAccountId = businessAccountId || wabaId;
      account.wabaId = wabaId || businessAccountId;
      account.displayPhoneNumber = String(whatsapp?.displayPhoneNumber || account.displayPhoneNumber || '').trim();
      account.verifiedName = String(whatsapp?.verifiedName || account.verifiedName || '').trim();
      account.accessTokenEncrypted = encryptSensitiveValue(accessToken);
      account.tokenType = 'Bearer';
      account.status = 'active';
      account.webhookSubscribed = Boolean(whatsapp?.webhookSubscribed);
      account.isActive = true;
      account.numberClaimed = true;
      account.lastSyncAt = new Date();
      account.metadata = { ...(account.metadata || {}), updatedByAdmin: true };
      // Exactly one account stays active per user — the webhook routes by
      // phoneNumberId and two active rows would make that ambiguous.
      await WhatsAppAccount.updateMany(
        { userId: user._id, _id: { $ne: account._id } },
        { $set: { isActive: false } }
      );
      await account.save();
    }

    if (whatsapp?.clearAccount === true) {
      await WhatsAppAccount.deleteMany({ userId: user._id });
      account = null;
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully.',
      item: { ...sanitizeUser(user), whatsappAccount: sanitizeAccount(account) },
    });
  } catch (error: any) {
    logger.error('Update user error:', error?.message);
    if (error?.statusCode === 409 || error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: error.message || 'This WhatsApp number is already connected to a different account.' },
        { status: 409 }
      );
    }
    return errorResponse(error, 'Failed to update user.');
  }
}
