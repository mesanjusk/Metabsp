import axios, { AxiosRequestConfig } from 'axios';
import AppError from '@/lib/utils/AppError';
import { decryptSensitiveValue, encryptSensitiveValue } from '@/lib/utils/crypto';
import { GoogleBusinessAccount } from '@/lib/models';

/**
 * Google Business Profile — the provider connection itself.
 *
 * Why Google directly and not a reseller: every "AI local growth" product an
 * SMB is sold (Grexa, Birdeye, Podium, Broadly) is a *tenant* of these same
 * public APIs. Buying one would put a second vendor between this workspace and
 * the merchant's own profile, priced per location, and would fork the customer
 * record — which is the one thing docs/SMB_DIGITAL_OS.md says must not happen.
 * Google's APIs are free, first-party, and the merchant authorises them with
 * their own Google account, so the connection is theirs and not ours to resell.
 *
 * The scope below is the only one these APIs accept. `plus.business.manage` is
 * its deprecated alias and is deliberately not requested.
 */
export const GOOGLE_BUSINESS_SCOPES = ['https://www.googleapis.com/auth/business.manage'] as const;

// Google splits what used to be one "My Business" API across five hosts. The
// two that never moved to v1 — reviews and local posts — still live on v4, so
// both base URLs are real rather than one being legacy.
export const GOOGLE_HOSTS = {
  oauthToken: 'https://oauth2.googleapis.com/token',
  oauthAuthorize: 'https://accounts.google.com/o/oauth2/v2/auth',
  userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
  accountManagement: 'https://mybusinessaccountmanagement.googleapis.com/v1',
  businessInformation: 'https://mybusinessbusinessinformation.googleapis.com/v1',
  legacy: 'https://mybusiness.googleapis.com/v4',
  performance: 'https://businessprofileperformance.googleapis.com/v1',
} as const;

export function getGoogleBusinessConfig() {
  // A deployment that already runs Google sign-in has a client in the same
  // Cloud project; the dedicated variables let it use a separate one without
  // disturbing that. Sign-in needs no secret, so the secret is only ever read
  // from these paths.
  const clientId = String(process.env.GOOGLE_BUSINESS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_BUSINESS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const publicOrigin = String(process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const redirectUri =
    String(process.env.GOOGLE_BUSINESS_REDIRECT_URI || '').trim() ||
    (publicOrigin ? `${publicOrigin}/api/google-business/oauth/callback` : '');

  if (!clientId || !clientSecret) {
    throw new AppError('Google Business Profile client ID/secret are not configured', 503);
  }
  if (!redirectUri) {
    throw new AppError('GOOGLE_BUSINESS_REDIRECT_URI or FRONTEND_URL must be configured', 503);
  }

  return { clientId, clientSecret, redirectUri };
}

/** Whether this deployment can offer the connection at all, without throwing. */
export function isGoogleBusinessConfigured(): boolean {
  try {
    getGoogleBusinessConfig();
    return true;
  } catch (_error) {
    return false;
  }
}

export function buildGoogleAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = getGoogleBusinessConfig();
  const url = new URL(GOOGLE_HOSTS.oauthAuthorize);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', [...GOOGLE_BUSINESS_SCOPES, 'openid', 'email'].join(' '));
  // Without both of these Google returns an access token and no refresh token,
  // and the connection silently dies an hour later. `prompt=consent` is also
  // what makes a *re*-connect return a new refresh token rather than nothing.
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  return url.toString();
}

function normalizeGoogleError(error: any, fallback: string): AppError {
  const data = error?.response?.data;
  const message =
    data?.error?.message ||
    data?.error_description ||
    (typeof data?.error === 'string' ? data.error : '') ||
    data?.message;
  const status = Number(error?.response?.status || 502);

  // 401/403 from Google here means the merchant revoked access or the profile
  // was moved to another account — both are "reconnect", not "retry".
  if (status === 401 || status === 403) {
    return new AppError(message || 'Google rejected the stored authorization. Reconnect the profile.', status);
  }
  if (status === 429) {
    return new AppError(message || 'Google Business Profile API quota exceeded. Try again shortly.', 429);
  }
  return new AppError(message || fallback, status >= 400 && status < 500 ? 400 : 502);
}

export async function exchangeGoogleCode(code: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleBusinessConfig();
  const form = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  try {
    const response = await axios.post(GOOGLE_HOSTS.oauthToken, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    const refreshToken = String(response.data?.refresh_token || '');
    if (!refreshToken) {
      throw new AppError(
        'Google did not return a refresh token. Remove this app at myaccount.google.com/permissions and connect again.',
        400
      );
    }

    return {
      refreshToken,
      accessToken: String(response.data?.access_token || ''),
      expiresIn: Number(response.data?.expires_in || 0) || 3600,
      scopes: String(response.data?.scope || '').split(' ').filter(Boolean),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw normalizeGoogleError(error, 'Failed to exchange the Google authorization code');
  }
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGoogleBusinessConfig();
  const form = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  try {
    const response = await axios.post(GOOGLE_HOSTS.oauthToken, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    const accessToken = String(response.data?.access_token || '');
    if (!accessToken) throw new AppError('Google did not return an access token', 502);
    return { accessToken, expiresIn: Number(response.data?.expires_in || 0) || 3600 };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw normalizeGoogleError(error, 'Failed to refresh the Google access token');
  }
}

export async function revokeGoogleToken(token: string): Promise<boolean> {
  try {
    await axios.post('https://oauth2.googleapis.com/revoke', new URLSearchParams({ token }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });
    return true;
  } catch (_error) {
    // Disconnect must still succeed when Google has already dropped the grant.
    return false;
  }
}

export async function googleRequest<T = any>(
  url: string,
  accessToken: string,
  config: AxiosRequestConfig = {}
): Promise<T> {
  try {
    const response = await axios.request<T>({
      method: 'GET',
      ...config,
      url,
      headers: { Authorization: `Bearer ${accessToken}`, ...(config.headers || {}) },
      timeout: config.timeout || 20000,
    });
    return response.data;
  } catch (error) {
    throw normalizeGoogleError(error, 'Google Business Profile API request failed');
  }
}

export async function getActiveGoogleBusinessAccount(userId: string) {
  return GoogleBusinessAccount.findOne({ userId, isActive: true, status: { $ne: 'disconnected' } });
}

/**
 * The connection plus a usable access token, refreshing when the cached one is
 * within a minute of expiry.
 *
 * The refreshed token is written back so that a burst of requests from one page
 * load costs one token call rather than one per endpoint.
 */
export async function getGoogleBusinessAccess(userId: string) {
  const account: any = await getActiveGoogleBusinessAccount(userId);
  if (!account) throw new AppError('Connect a Google Business Profile first', 409);

  const cachedExpiry = account.accessTokenExpiresAt ? new Date(account.accessTokenExpiresAt).getTime() : 0;
  if (account.accessTokenEncrypted && cachedExpiry - 60_000 > Date.now()) {
    return { account, accessToken: decryptSensitiveValue(account.accessTokenEncrypted) };
  }

  const refreshToken = decryptSensitiveValue(account.refreshTokenEncrypted);
  try {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    account.accessTokenEncrypted = encryptSensitiveValue(refreshed.accessToken);
    account.accessTokenExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
    account.status = 'active';
    account.lastError = '';
    await account.save();
    return { account, accessToken: refreshed.accessToken };
  } catch (error: any) {
    // A refresh token Google has revoked never recovers on retry. Recording it
    // is what lets the dashboard say "reconnect" instead of failing every call.
    if (error?.statusCode === 400 || error?.statusCode === 401 || error?.statusCode === 403) {
      await GoogleBusinessAccount.findByIdAndUpdate(account._id, {
        $set: { status: 'error', lastError: String(error?.message || 'Authorization expired').slice(0, 300) },
      });
      throw new AppError('Google authorization has expired. Reconnect the Business Profile.', 401);
    }
    throw error;
  }
}

export function sanitizeGoogleBusinessAccount(account: any) {
  if (!account) return null;
  return {
    id: String(account._id),
    googleEmail: account.googleEmail || '',
    accountName: account.accountName || '',
    accountDisplayName: account.accountDisplayName || '',
    locationName: account.locationName || '',
    locationTitle: account.locationTitle || '',
    locationAddress: account.locationAddress || '',
    locationPhone: account.locationPhone || '',
    locationWebsite: account.locationWebsite || '',
    mapsUri: account.mapsUri || '',
    newReviewUri: account.newReviewUri || '',
    scopes: account.scopes || [],
    status: account.status,
    isActive: Boolean(account.isActive),
    lastError: account.lastError || '',
    connectedAt: account.connectedAt,
    lastSyncAt: account.lastSyncAt,
  };
}
