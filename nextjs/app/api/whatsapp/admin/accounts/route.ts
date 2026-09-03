import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { User } from '@/lib/models';

/**
 * Every WhatsApp account on the deployment, whoever owns it.
 *
 * The product had only per-user views of accounts, and that is a real gap
 * rather than a missing convenience: an inbound webhook resolves a number by
 * `phone_number_id` across ALL accounts, so the thing that answers for a
 * number is not "the account belonging to the user you are looking at". When
 * two rows claim one number, the per-user screens cannot show you that, and
 * an operator ends up guessing which user to edit.
 *
 * That is exactly how a deployment spent hours with a stale row it could see
 * the effects of and could not find: its `wabaId` held a Meta App ID, every
 * inbound message was silently dropped, and the screens available only ever
 * showed one user's view at a time.
 *
 * So this lists accounts, not users, and names the owner rather than being
 * organised by them.
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const accounts: any[] = await WhatsAppAccount.find({})
      .select(
        '_id userId phoneNumberId displayPhoneNumber verifiedName wabaId businessAccountId status isActive webhookSubscribed connectionMode lastWebhookAt lastSyncAt createdAt'
      )
      .sort({ isActive: -1, updatedAt: -1 })
      .limit(200)
      .lean();

    // One query for the owners rather than one per account, and a missing
    // owner is reported as such: an account whose user is gone is precisely
    // the kind of row that outlives what created it.
    const ownerIds = [...new Set(accounts.map((a) => String(a.userId || '')).filter(Boolean))];
    const owners: any[] = ownerIds.length
      ? await User.find({ _id: { $in: ownerIds } }).select('_id mobile Display_name User_group').lean()
      : [];
    const ownerById = new Map(owners.map((o: any) => [String(o._id), o]));

    // Which numbers are claimed by more than one row. This is the finding the
    // whole screen exists for, so it is computed here rather than left for the
    // reader to spot by eye.
    const countsByNumber = accounts.reduce<Record<string, number>>((acc, a) => {
      const key = String(a.phoneNumberId || '');
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const data = accounts.map((account: any) => {
      const owner = ownerById.get(String(account.userId || ''));
      return {
        id: String(account._id),
        phoneNumberId: account.phoneNumberId || '',
        displayPhoneNumber: account.displayPhoneNumber || '',
        verifiedName: account.verifiedName || '',
        wabaId: account.wabaId || '',
        businessAccountId: account.businessAccountId || '',
        status: account.status || '',
        isActive: Boolean(account.isActive),
        webhookSubscribed: Boolean(account.webhookSubscribed),
        connectionMode: account.connectionMode || '',
        lastWebhookAt: account.lastWebhookAt ? new Date(account.lastWebhookAt).toISOString() : null,
        owner: owner
          ? { id: String(owner._id), mobile: owner.mobile || '', displayName: owner.Display_name || '' }
          : null,
        // True when the owning user no longer exists. Nothing in the per-user
        // screens can reach such a row, which is why it can be deleted here.
        orphaned: Boolean(account.userId) && !owner,
        duplicateNumber: (countsByNumber[String(account.phoneNumberId || '')] || 0) > 1,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      summary: {
        total: data.length,
        active: data.filter((a) => a.isActive).length,
        orphaned: data.filter((a) => a.orphaned).length,
        duplicateNumbers: [...new Set(data.filter((a) => a.duplicateNumber).map((a) => a.phoneNumberId))],
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to list WhatsApp accounts');
  }
}
