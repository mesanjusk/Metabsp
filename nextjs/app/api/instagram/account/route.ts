import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstagramAccount } from '@/lib/models';
import {
  getActiveInstagramAccount,
  getInstagramAccess,
  instagramGraphRequest,
  sanitizeInstagramAccount,
} from '@/lib/instagram/meta';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const account = await getActiveInstagramAccount(authed.id);
    return NextResponse.json({ success: true, data: sanitizeInstagramAccount(account) });
  } catch (error) {
    return errorResponse(error, 'Failed to load Instagram account');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
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
