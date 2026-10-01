import crypto from 'crypto';
import AppError from '@/lib/utils/AppError';

export type RcsRegion = 'asia' | 'europe' | 'us';

type ServiceAccount = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __metabspRcsAccessToken:
    | { token: string; expiresAt: number }
    | undefined;
}

const RBM_SCOPE = 'https://www.googleapis.com/auth/rcsbusinessmessaging';

function parseServiceAccount(): ServiceAccount {
  const base64 = String(process.env.RCS_SERVICE_ACCOUNT_JSON_BASE64 || '').trim();
  const raw = base64
    ? Buffer.from(base64, 'base64').toString('utf8')
    : String(process.env.RCS_SERVICE_ACCOUNT_JSON || '').trim();

  if (!raw) {
    throw new AppError(
      'RCS service account is not configured. Add RCS_SERVICE_ACCOUNT_JSON_BASE64 in Render.',
      409
    );
  }

  let parsed: ServiceAccount;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    throw new AppError('RCS service account JSON is invalid', 500);
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new AppError('RCS service account JSON is missing client_email or private_key', 500);
  }

  return parsed;
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function accessToken(): Promise<string> {
  const cached = global.__metabspRcsAccessToken;
  if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token;

  const serviceAccount = parseServiceAccount();
  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);

  const unsigned = [
    base64UrlJson({ alg: 'RS256', typ: 'JWT' }),
    base64UrlJson({
      iss: serviceAccount.client_email,
      scope: RBM_SCOPE,
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  ].join('.');

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .end()
    .sign(String(serviceAccount.private_key))
    .toString('base64url');

  const assertion = `${unsigned}.${signature}`;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) {
    throw new AppError('Google rejected the RCS service-account authentication', 502);
  }

  global.__metabspRcsAccessToken = {
    token: String(data.access_token),
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };

  return String(data.access_token);
}

function host(region: RcsRegion) {
  return `https://${region}-rcsbusinessmessaging.googleapis.com`;
}

export function normalizeRcsPhone(value: unknown): string {
  const phone = String(value || '').replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new AppError('Phone number must be in E.164 format, for example +919876543210', 400);
  }
  return phone;
}

async function authorizedFetch(region: RcsRegion, path: string, init: RequestInit = {}) {
  const token = await accessToken();
  return fetch(`${host(region)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'metabsp-rcs/1.0',
      ...(init.headers || {}),
    },
  });
}

export async function checkRcsCapabilities({
  agentId,
  region,
  phone,
}: {
  agentId: string;
  region: RcsRegion;
  phone: string;
}) {
  const normalized = normalizeRcsPhone(phone);
  const requestId = crypto.randomUUID();
  const query = new URLSearchParams({ requestId, agentId });
  const response = await authorizedFetch(
    region,
    `/v1/phones/${encodeURIComponent(normalized)}/capabilities?${query.toString()}`
  );

  if (response.status === 404) {
    return { reachable: false, phone: normalized, features: [] as string[], carrier: '' };
  }

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(
      String(data?.error?.message || 'RCS capability check failed'),
      response.status >= 400 && response.status < 500 ? response.status : 502
    );
  }

  return {
    reachable: true,
    phone: normalized,
    features: Array.isArray(data?.features) ? data.features.map(String) : [],
    carrier: String(data?.carrier || ''),
  };
}

export async function sendRcsText({
  agentId,
  region,
  phone,
  text,
  trafficType,
  suggestions = [],
}: {
  agentId: string;
  region: RcsRegion;
  phone: string;
  text: string;
  trafficType: string;
  suggestions?: unknown[];
}) {
  const normalized = normalizeRcsPhone(phone);
  const messageId = crypto.randomUUID();
  const query = new URLSearchParams({ messageId, agentId });
  const payload: any = {
    contentMessage: {
      text,
      ...(suggestions.length ? { suggestions: suggestions.slice(0, 11) } : {}),
    },
    messageTrafficType: trafficType,
  };

  const response = await authorizedFetch(
    region,
    `/v1/phones/${encodeURIComponent(normalized)}/agentMessages?${query.toString()}`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
  const data: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new AppError(
      String(data?.error?.message || 'Google RCS message send failed'),
      response.status >= 400 && response.status < 500 ? response.status : 502
    );
  }

  return { messageId, phone: normalized, data };
}

export function rcsRuntimeStatus() {
  return {
    serviceAccountConfigured: Boolean(
      String(process.env.RCS_SERVICE_ACCOUNT_JSON_BASE64 || process.env.RCS_SERVICE_ACCOUNT_JSON || '').trim()
    ),
    webhookTokenConfigured: Boolean(String(process.env.RCS_WEBHOOK_CLIENT_TOKEN || '').trim()),
    smsFallbackConfigured: Boolean(String(process.env.RCS_SMS_FALLBACK_URL || '').trim()),
  };
}
