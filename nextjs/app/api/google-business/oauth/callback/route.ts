import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { getJwtSecret } from '@/lib/auth/jwt';
import { GoogleBusinessAccount, User } from '@/lib/models';
import { encryptSensitiveValue } from '@/lib/utils/crypto';
import logger from '@/lib/utils/logger';
import {
  exchangeGoogleCode,
  GOOGLE_HOSTS,
  googleRequest,
  refreshGoogleAccessToken,
  resolveGoogleBusinessConfig,
} from '@/lib/googleBusiness/google';
import { listGoogleAccounts, listGoogleLocations } from '@/lib/googleBusiness/profile';

function dashboardRedirect(req: NextRequest, params: Record<string, string>) {
  const origin = (process.env.FRONTEND_URL || req.nextUrl.origin).replace(/\/$/, '');
  const url = new URL('/services/google-business', origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') || '';
  const state = req.nextUrl.searchParams.get('state') || '';
  const oauthError = req.nextUrl.searchParams.get('error') || '';

  if (oauthError) return dashboardRedirect(req, { error: String(oauthError).slice(0, 240) });
  if (!code || !state) {
    return dashboardRedirect(req, { error: 'Google authorization did not return a code.' });
  }

  try {
    const decoded = jwt.verify(state, getJwtSecret()) as { id?: string; purpose?: string };
    if (!decoded?.id || decoded.purpose !== 'google-business-oauth') {
      return dashboardRedirect(req, { error: 'Google authorization state is invalid.' });
    }

    await connectDB();
    const user: any = await User.findById(decoded.id);
    if (!user || !user.isActive) return dashboardRedirect(req, { error: 'Dashboard user is unavailable.' });

    // Recorded against the connection so a later client rotation can be
    // reported as "reconnect" rather than surfacing as a broken refresh.
    const { clientId: issuedByClientId } = await resolveGoogleBusinessConfig();
    const exchanged = await exchangeGoogleCode(code);
    const accessToken =
      exchanged.accessToken || (await refreshGoogleAccessToken(exchanged.refreshToken)).accessToken;

    // Who authorised, for the "connected as" line. Optional: the connection is
    // still valid if the merchant declined the profile scopes' email claim.
    let googleEmail = '';
    let googleUserId = '';
    try {
      const identity: any = await googleRequest(GOOGLE_HOSTS.userinfo, accessToken);
      googleEmail = String(identity?.email || '');
      googleUserId = String(identity?.sub || '');
    } catch (_error) {
      // Not fatal.
    }

    // Preselect the profile when the merchant manages exactly one, which is the
    // normal single-shop case. More than one and the dashboard asks.
    const accounts = await listGoogleAccounts(accessToken);
    const account = accounts[0] || null;
    let location: any = null;
    if (accounts.length === 1 && account) {
      try {
        const locations = await listGoogleLocations(accessToken, account.name);
        if (locations.length === 1) location = locations[0];
      } catch (error: any) {
        logger.warn('[google-business] Location preselect failed:', error?.message || error);
      }
    }

    await GoogleBusinessAccount.updateMany(
      { userId: decoded.id, isActive: true },
      { $set: { isActive: false, status: 'disconnected' } }
    );

    await GoogleBusinessAccount.create({
      userId: decoded.id,
      tenantId: user.tenantId || null,
      googleUserId,
      googleEmail,
      accountName: account?.name || '',
      accountDisplayName: account?.accountName || '',
      locationName: location?.name || '',
      locationTitle: location?.title || '',
      locationAddress: location?.address || '',
      locationPhone: location?.phone || '',
      locationWebsite: location?.website || '',
      mapsUri: location?.mapsUri || '',
      newReviewUri: location?.newReviewUri || '',
      issuedByClientId,
      refreshTokenEncrypted: encryptSensitiveValue(exchanged.refreshToken),
      accessTokenEncrypted: encryptSensitiveValue(accessToken),
      accessTokenExpiresAt: new Date(Date.now() + exchanged.expiresIn * 1000),
      scopes: exchanged.scopes,
      status: 'active',
      isActive: true,
      connectedAt: new Date(),
      lastSyncAt: new Date(),
    });

    return dashboardRedirect(req, { connected: '1' });
  } catch (error: any) {
    logger.error('[google-business] OAuth callback failed:', error?.message || error);
    return dashboardRedirect(req, {
      error: String(error?.message || 'Google authorization failed').slice(0, 240),
    });
  }
}
