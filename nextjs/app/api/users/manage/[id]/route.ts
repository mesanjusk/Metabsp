import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { sanitizeUser } from '@/lib/http/sanitizeUser';
import { User } from '@/lib/models';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { getGlobalRoles } from '@/lib/auth/globalRoles';
import { assertPhoneNumberAvailable, sanitizeAccount } from '@/lib/services/whatsappAccountService';
import { canWriteWhatsAppAccount, resolveAccountIds } from '@/lib/services/adminAccountEdit';
import { normalizeAccountMobile, isPlausibleMobile, mobileLookupCandidates } from '@/lib/utils/accountMobile';
import { encryptSensitiveValue } from '@/lib/utils/crypto';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import logger from '@/lib/utils/logger';

// Ported from backend/src/routes/Users.js's PUT /manage/:id.
//
// The mobile number is the account's identity, so it is what this validates
// and what uniqueness is checked against. It is also why an omitted
// Mobile_number now leaves the stored one alone rather than blanking it: the
// previous version assigned `String(Mobile_number || '')` unconditionally,
// which would erase the identifier of any account saved from a form that did
// not happen to include the field.

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { Password, Mobile_number, Display_name, User_group = 'user', whatsapp = {} } = body || {};

    const user: any = await User.findById(id).populate('roleId');
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const mobileProvided = Mobile_number !== undefined && String(Mobile_number).trim() !== '';
    const mobile = mobileProvided ? normalizeAccountMobile(Mobile_number) : String(user.mobile || '').trim();

    if (!mobile) {
      return NextResponse.json({ success: false, message: 'Mobile number is required.' }, { status: 400 });
    }
    if (mobileProvided && !isPlausibleMobile(mobile)) {
      return NextResponse.json(
        { success: false, message: 'Enter a valid mobile number, including the country code.' },
        { status: 400 }
      );
    }

    const conflictUser = await User.findOne({
      tenantId: null,
      _id: { $ne: user._id },
      $or: [{ mobile: { $in: mobileLookupCandidates(mobile) } }, { username: mobile }],
    }).lean();
    if (conflictUser) {
      return NextResponse.json({ success: false, message: 'Another account already uses this mobile number.' }, { status: 409 });
    }

    const { adminRole, userRole } = await getGlobalRoles();

    const displayName = Display_name === undefined ? String(user.name || '') : String(Display_name).trim();

    user.mobile = mobile;
    // The seeded `admin` account keeps its username so it can still sign in
    // that way; every other account is identified by its number.
    if (String(user.username || '').toLowerCase() !== 'admin') user.username = mobile;
    user.name = displayName || mobile;
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

    // Creating an account needs a token; correcting one does not. The panel
    // cannot prefill the token — the API strips it, and it must — so requiring
    // it to save ANY field meant an admin who fixed a wrong wabaId and pressed
    // save got a success message and no write at all. That silence is
    // expensive on exactly the field it hides: a wrong WABA id costs every
    // inbound message, and the one screen built to correct it appeared to work.
    const canWriteAccount = canWriteWhatsAppAccount({
      hasExistingAccount: Boolean(account),
      accessToken,
      phoneNumberId,
      businessAccountId,
      wabaId,
    });

    if (canWriteAccount) {
      const ids = resolveAccountIds({
        stored: {
          phoneNumberId: account?.phoneNumberId,
          businessAccountId: account?.businessAccountId,
          wabaId: account?.wabaId,
        },
        submitted: { phoneNumberId, businessAccountId, wabaId },
      });
      const effectivePhoneNumberId = ids.phoneNumberId;
      if (!account || effectivePhoneNumberId !== account.phoneNumberId) {
        await assertPhoneNumberAvailable({
          phoneNumberId: effectivePhoneNumberId,
          userId: user._id,
          excludeAccountId: account?._id,
        });
      }
      if (!account) {
        account = new WhatsAppAccount({
          userId: user._id,
          phoneNumberId: effectivePhoneNumberId,
          accessTokenEncrypted: encryptSensitiveValue(accessToken),
        });
      }
      account.connectionMode = 'manual';
      account.phoneNumberId = effectivePhoneNumberId;
      account.businessAccountId = ids.businessAccountId;
      account.wabaId = ids.wabaId;
      account.displayPhoneNumber = String(whatsapp?.displayPhoneNumber || account.displayPhoneNumber || '').trim();
      account.verifiedName = String(whatsapp?.verifiedName || account.verifiedName || '').trim();
      if (accessToken) account.accessTokenEncrypted = encryptSensitiveValue(accessToken);
      account.tokenType = 'Bearer';
      account.status = 'active';
      // Only when the caller said something about it. Defaulting a missing
      // field to false would record "not subscribed" on every unrelated edit.
      if (typeof whatsapp?.webhookSubscribed === 'boolean') {
        account.webhookSubscribed = whatsapp.webhookSubscribed;
      }
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

/**
 * Remove a sign-in account and the WhatsApp account attached to it.
 *
 * The WhatsApp rows go with the user rather than being orphaned, because a
 * row nobody owns is worse than no row: inbound webhooks resolve a number by
 * phone_number_id across every account, so a stale row keeps competing to
 * answer for a number long after the person it belonged to is gone. That is
 * not hypothetical — a duplicate account left behind by an earlier edit is
 * exactly what kept a corrected WABA id from taking effect.
 *
 * An admin cannot delete themselves. Not a policy nicety: the panel is the
 * only place these accounts can be managed, and an admin who removes their
 * own sign-in locks everyone out of it with no way back in.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const { id } = await params;

    if (String(id) === String(authed.id)) {
      return NextResponse.json(
        { success: false, message: 'You cannot delete the account you are signed in with.' },
        { status: 400 }
      );
    }

    const user: any = await User.findById(id);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const accounts: any[] = await WhatsAppAccount.find({ userId: user._id })
      .select('_id phoneNumberId wabaId')
      .lean();

    await WhatsAppAccount.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });

    // Worth a line of its own: this is how a phone number stops being claimed
    // by two accounts, and the numbers are what someone will search for when
    // they wonder where a connection went.
    logger.info(
      `[admin] Deleted user ${user._id} and ${accounts.length} WhatsApp account(s): ` +
        accounts.map((a) => `phone_number_id ${a.phoneNumberId || 'none'} / WABA ${a.wabaId || 'none'}`).join('; ')
    );

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'user.delete',
      resource: 'user',
      resourceId: user._id,
      metadata: {
        deletedMobile: user.mobile || '',
        whatsappAccountsRemoved: accounts.length,
        phoneNumberIds: accounts.map((a) => a.phoneNumberId).filter(Boolean),
      },
    });

    return NextResponse.json({
      success: true,
      message: `User removed, along with ${accounts.length} connected WhatsApp account(s).`,
      whatsappAccountsRemoved: accounts.length,
    });
  } catch (error) {
    return errorResponse(error, 'Failed to delete user');
  }
}
