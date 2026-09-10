import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { getJwtSecret } from '@/lib/auth/jwt';
import { InstagramAccount, User } from '@/lib/models';
import { encryptSensitiveValue } from '@/lib/utils/crypto';
import {
  exchangeInstagramCode,
  fetchInstagramProfile,
  INSTAGRAM_SCOPES,
  subscribeInstagramWebhooks,
} from '@/lib/instagram/meta';

function dashboardRedirect(req: NextRequest, params: Record<string, string>) {
  const origin = (process.env.FRONTEND_URL || req.nextUrl.origin).replace(/\/$/, '');
  const url = new URL('/instagram', origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') || '';
  const state = req.nextUrl.searchParams.get('state') || '';
  const oauthError = req.nextUrl.searchParams.get('error_description') || req.nextUrl.searchParams.get('error');

  if (oauthError) return dashboardRedirect(req, { error: String(oauthError).slice(0, 240) });
  if (!code || !state) return dashboardRedirect(req, { error: 'Instagram authorization did not return code/state.' });

  try {
    const decoded = jwt.verify(state, getJwtSecret()) as { id?: string; purpose?: string };
    if (!decoded?.id || decoded.purpose !== 'instagram-oauth') {
      return dashboardRedirect(req, { error: 'Instagram authorization state is invalid.' });
    }

    await connectDB();
    const user: any = await User.findById(decoded.id);
    if (!user || !user.isActive) return dashboardRedirect(req, { error: 'Dashboard user is unavailable.' });

    const exchanged = await exchangeInstagramCode(code);
    const profile: any = await fetchInstagramProfile(exchanged.accessToken);
    const instagramUserId = String(profile?.user_id || profile?.id || exchanged.appScopedUserId || '');
    if (!instagramUserId) return dashboardRedirect(req, { error: 'Instagram account ID could not be resolved.' });

    const webhookSubscribed = await subscribeInstagramWebhooks(instagramUserId, exchanged.accessToken);
    const tokenExpiresAt = exchanged.expiresIn
      ? new Date(Date.now() + exchanged.expiresIn * 1000)
      : null;

    await InstagramAccount.updateMany(
      { userId: decoded.id, isActive: true, instagramUserId: { $ne: instagramUserId } },
      { $set: { isActive: false, status: 'disconnected' } }
    );

    await InstagramAccount.findOneAndUpdate(
      { userId: decoded.id, instagramUserId },
      {
        $set: {
          tenantId: user.tenantId || null,
          instagramAppScopedId: String(profile?.id || exchanged.appScopedUserId || ''),
          username: String(profile?.username || ''),
          name: String(profile?.name || ''),
          accountType: String(profile?.account_type || ''),
          profilePictureUrl: String(profile?.profile_picture_url || ''),
          accessTokenEncrypted: encryptSensitiveValue(exchanged.accessToken),
          tokenExpiresAt,
          permissions: exchanged.permissions?.length ? exchanged.permissions : [...INSTAGRAM_SCOPES],
          webhookSubscribed,
          status: 'active',
          isActive: true,
          connectedAt: new Date(),
          lastSyncAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return dashboardRedirect(req, { connected: '1' });
  } catch (error: any) {
    return dashboardRedirect(req, {
      error: String(error?.message || 'Instagram authorization failed').slice(0, 240),
    });
  }
}
