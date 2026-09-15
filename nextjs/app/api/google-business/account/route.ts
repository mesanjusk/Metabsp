import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { GoogleBusinessAccount } from '@/lib/models';
import { decryptSensitiveValue } from '@/lib/utils/crypto';
import {
  getActiveGoogleBusinessAccount,
  getGoogleBusinessAccess,
  isGoogleBusinessConfigured,
  revokeGoogleToken,
  sanitizeGoogleBusinessAccount,
} from '@/lib/googleBusiness/google';
import { isAiDraftingConfigured } from '@/lib/googleBusiness/ai';
import { listGoogleLocations } from '@/lib/googleBusiness/profile';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const account = await getActiveGoogleBusinessAccount(authed.id);
    return NextResponse.json({
      success: true,
      data: {
        account: sanitizeGoogleBusinessAccount(account),
        // The dashboard has to tell "nobody has connected yet" apart from "this
        // deployment has no Google client configured", because only one of them
        // is something the shop owner can fix.
        configured: await isGoogleBusinessConfigured(),
        aiConfigured: isAiDraftingConfigured(),
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load the Google Business connection');
  }
}

/** Choose which account/location this workspace manages. */
export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json();
    const accountName = String(body?.accountName || '').trim();
    const locationName = String(body?.locationName || '').trim();
    if (!accountName || !locationName) {
      throw new AppError('accountName and locationName are required', 400);
    }

    const { account, accessToken } = await getGoogleBusinessAccess(authed.id);
    // Resolved against Google rather than trusted from the request: the client
    // could name any location string, and the stored maps/review links have to
    // be the ones Google actually hands out for it.
    const locations = await listGoogleLocations(accessToken, accountName);
    const selected = locations.find((item: any) => item.name === locationName);
    if (!selected) throw new AppError('That location is not managed by this Google account', 404);

    account.accountName = accountName;
    account.locationName = selected.name;
    account.locationTitle = selected.title;
    account.locationAddress = selected.address;
    account.locationPhone = selected.phone;
    account.locationWebsite = selected.website;
    account.mapsUri = selected.mapsUri;
    account.newReviewUri = selected.newReviewUri;
    account.metadata = { ...(account.metadata || {}), primaryCategory: selected.primaryCategory, description: selected.description };
    account.lastSyncAt = new Date();
    await account.save();

    return NextResponse.json({ success: true, data: sanitizeGoogleBusinessAccount(account) });
  } catch (error) {
    return errorResponse(error, 'Failed to select the Google Business location');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const account: any = await getActiveGoogleBusinessAccount(authed.id);
    if (!account) return NextResponse.json({ success: true });

    // Revoking at Google as well as locally: leaving a live grant behind on the
    // merchant's Google account after they pressed Disconnect here would be a
    // lie about what disconnecting did.
    try {
      await revokeGoogleToken(decryptSensitiveValue(account.refreshTokenEncrypted));
    } catch (_error) {
      // Already revoked, or the key rotated — the local disconnect still stands.
    }

    await GoogleBusinessAccount.findByIdAndUpdate(account._id, {
      $set: { isActive: false, status: 'disconnected', accessTokenEncrypted: '', accessTokenExpiresAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to disconnect the Google Business Profile');
  }
}
