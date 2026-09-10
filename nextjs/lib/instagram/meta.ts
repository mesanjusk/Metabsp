import axios, { AxiosRequestConfig } from 'axios';
import AppError from '@/lib/utils/AppError';
import { decryptSensitiveValue } from '@/lib/utils/crypto';
import { InstagramAccount } from '@/lib/models';

export const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
] as const;

export const INSTAGRAM_WEBHOOK_FIELDS = ['messages', 'messaging_postbacks', 'comments', 'mentions'] as const;

export function getInstagramConfig() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const version = process.env.INSTAGRAM_API_VERSION || 'v26.0';
  const publicOrigin = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || (publicOrigin ? `${publicOrigin}/api/instagram/oauth/callback` : '');

  if (!appId || !appSecret) {
    throw new AppError('Instagram App ID/Secret are not configured', 503);
  }
  if (!redirectUri) {
    throw new AppError('INSTAGRAM_REDIRECT_URI or FRONTEND_URL must be configured', 503);
  }

  return { appId, appSecret, version, redirectUri };
}

export function buildInstagramAuthorizationUrl(state: string) {
  const { appId, redirectUri } = getInstagramConfig();
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', INSTAGRAM_SCOPES.join(','));
  url.searchParams.set('state', state);
  url.searchParams.set('force_reauth', 'true');
  url.searchParams.set('enable_fb_login', '0');
  return url.toString();
}

function normalizeMetaError(error: any, fallback: string): AppError {
  const message = error?.response?.data?.error?.message || error?.response?.data?.error_message || error?.response?.data?.message;
  const status = Number(error?.response?.status || 502);
  return new AppError(message || fallback, status >= 400 && status < 500 ? 400 : 502);
}

function normalizePermissions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

export async function exchangeInstagramCode(code: string) {
  const { appId, appSecret, redirectUri } = getInstagramConfig();
  const form = new URLSearchParams();
  form.set('client_id', appId);
  form.set('client_secret', appSecret);
  form.set('grant_type', 'authorization_code');
  form.set('redirect_uri', redirectUri);
  form.set('code', code);

  try {
    const shortRes = await axios.post('https://api.instagram.com/oauth/access_token', form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    const shortToken = String(shortRes.data?.access_token || '');
    if (!shortToken) throw new AppError('Instagram did not return an access token', 502);

    const longRes = await axios.get('https://graph.instagram.com/access_token', {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: appSecret,
        access_token: shortToken,
      },
      timeout: 15000,
    });

    return {
      accessToken: String(longRes.data?.access_token || shortToken),
      expiresIn: Number(longRes.data?.expires_in || shortRes.data?.expires_in || 0) || null,
      appScopedUserId: String(shortRes.data?.user_id || ''),
      permissions: normalizePermissions(shortRes.data?.permissions),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw normalizeMetaError(error, 'Failed to exchange Instagram authorization code');
  }
}

export async function instagramGraphRequest<T = any>(
  path: string,
  accessToken: string,
  config: AxiosRequestConfig = {}
): Promise<T> {
  const { version } = getInstagramConfig();
  const cleanPath = path.replace(/^\/+/, '');
  const url = `https://graph.instagram.com/${version}/${cleanPath}`;

  try {
    const response = await axios.request<T>({
      method: 'GET',
      ...config,
      url,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(config.headers || {}),
      },
      timeout: config.timeout || 15000,
    });
    return response.data;
  } catch (error) {
    throw normalizeMetaError(error, 'Instagram API request failed');
  }
}

export async function fetchInstagramProfile(accessToken: string) {
  try {
    return await instagramGraphRequest<any>('me', accessToken, {
      params: { fields: 'id,user_id,username,name,account_type,profile_picture_url' },
    });
  } catch (_error) {
    // Keep onboarding resilient if Meta removes an optional profile field.
    return instagramGraphRequest<any>('me', accessToken, {
      params: { fields: 'id,user_id,username' },
    });
  }
}

export async function subscribeInstagramWebhooks(instagramUserId: string, accessToken: string): Promise<boolean> {
  try {
    const result: any = await instagramGraphRequest(`${instagramUserId}/subscribed_apps`, accessToken, {
      method: 'POST',
      params: { subscribed_fields: INSTAGRAM_WEBHOOK_FIELDS.join(',') },
    });
    return result?.success === true || result?.success === 'true';
  } catch (_error) {
    return false;
  }
}

export async function getActiveInstagramAccount(userId: string) {
  return InstagramAccount.findOne({ userId, isActive: true, status: 'active' });
}

export async function getInstagramAccess(userId: string) {
  const account: any = await getActiveInstagramAccount(userId);
  if (!account) throw new AppError('Connect an Instagram professional account first', 409);
  if (account.tokenExpiresAt && new Date(account.tokenExpiresAt).getTime() <= Date.now()) {
    throw new AppError('Instagram authorization has expired. Reconnect the account.', 401);
  }

  return {
    account,
    accessToken: decryptSensitiveValue(account.accessTokenEncrypted),
  };
}

export function sanitizeInstagramAccount(account: any) {
  if (!account) return null;
  return {
    id: String(account._id),
    instagramUserId: account.instagramUserId,
    username: account.username,
    name: account.name,
    accountType: account.accountType,
    profilePictureUrl: account.profilePictureUrl,
    permissions: account.permissions || [],
    webhookSubscribed: Boolean(account.webhookSubscribed),
    status: account.status,
    isActive: Boolean(account.isActive),
    connectedAt: account.connectedAt,
    tokenExpiresAt: account.tokenExpiresAt,
    lastSyncAt: account.lastSyncAt,
  };
}
