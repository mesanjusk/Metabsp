import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstagramAccount } from '@/lib/models';
import { requireInstagramService } from '@/lib/instagram/access';
import {
  getActiveInstagramAccount,
  getInstagramAccess,
  instagramGraphRequest,
  repairInstagramAccountConnection,
  sanitizeInstagramAccount,
} from '@/lib/instagram/meta';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireInstagramService(req);
    let account: any = await getActiveInstagramAccount(authed.id);

    // Older/partial connections can exist with a valid token but without the
    // display profile or app subscription. Repair those lazily so users do not
    // have to delete the connection merely to recover @username/webhooks.
    if (account && (!account.username || !account.webhookSubscribed)) {
      try {
        account = await repairInstagramAccountConnection(account);
      } catch (_error) {
        // Keep the dashboard usable even when Meta is temporarily unavailable.
        // The user can explicitly reconnect from the UI if repair still fails.
      }
    }

    return NextResponse.json({ success: true, data: sanitizeInstagramAccount(account) });
  } catch (error) {
    return errorResponse(error, 'Failed to load Instagram account');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireInstagramService(req);
    const { account, accessToken } = await getInstagramAccess(authed.id);

    try {
      await instagramGraphRequest(`${account.instagramUserId}/subscribed_apps`, accessToken, { method: 'DELETE' });
    } catch (_error) {
      // Disconnection must still work if Meta has already revoked the token.
    }

    await InstagramAccount.findByIdAndUpdate(account._id, {
      $set: { isActive: false, status: 'disconnected', webhookSubscribed: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to disconnect Instagram account');
  }
}
