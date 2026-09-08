import AppError from '../utils/AppError';

type AccountContext = {
  graphVersion: string;
  accessToken: string;
  phoneNumberId: string;
  wabaId?: string;
};

const GRAPH_ROOT = 'https://graph.facebook.com';

function requireValue(value: unknown, label: string) {
  const text = String(value || '').trim();
  if (!text) throw new AppError(`${label} is unavailable for this WhatsApp account`, 400);
  return text;
}

function buildUrl(account: AccountContext, path: string, query: Record<string, unknown> = {}) {
  const version = requireValue(account.graphVersion, 'Graph API version');
  const url = new URL(`${GRAPH_ROOT}/${version}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function graphRequest(
  account: AccountContext,
  path: string,
  options: RequestInit & { query?: Record<string, unknown> } = {}
) {
  const accessToken = requireValue(account.accessToken, 'WhatsApp access token');
  const { query, ...init } = options;
  const response = await fetch(buildUrl(account, path, query), {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });

  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const metaMessage = String(payload?.error?.message || payload?.message || '').trim();
    const metaCode = payload?.error?.code ? ` (Meta ${payload.error.code})` : '';
    throw new AppError(metaMessage ? `${metaMessage}${metaCode}` : `Meta Graph API request failed${metaCode}`, response.status >= 500 ? 502 : 400);
  }
  return payload;
}

export async function getBusinessProfile(account: AccountContext) {
  const phoneNumberId = requireValue(account.phoneNumberId, 'Phone number ID');
  const payload = await graphRequest(account, `${phoneNumberId}/whatsapp_business_profile`, {
    query: { fields: 'about,address,description,email,profile_picture_url,websites,vertical' },
  });
  const row = payload?.data?.[0] || {};
  return row.business_profile || row;
}

export async function updateBusinessProfile(account: AccountContext, input: any = {}) {
  const phoneNumberId = requireValue(account.phoneNumberId, 'Phone number ID');
  const allowed = ['about', 'address', 'description', 'email', 'vertical'] as const;
  const body: Record<string, unknown> = { messaging_product: 'whatsapp' };
  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(input, field)) body[field] = String(input[field] || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(input, 'websites')) {
    body.websites = (Array.isArray(input.websites) ? input.websites : [])
      .map((value: unknown) => String(value || '').trim())
      .filter(Boolean)
      .slice(0, 2);
  }
  return graphRequest(account, `${phoneNumberId}/whatsapp_business_profile`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCommerceSettings(account: AccountContext) {
  const phoneNumberId = requireValue(account.phoneNumberId, 'Phone number ID');
  const payload = await graphRequest(account, `${phoneNumberId}/whatsapp_commerce_settings`);
  return payload?.data?.[0] || { is_cart_enabled: false, is_catalog_visible: false };
}

export async function updateCommerceSettings(account: AccountContext, input: any = {}) {
  const phoneNumberId = requireValue(account.phoneNumberId, 'Phone number ID');
  return graphRequest(account, `${phoneNumberId}/whatsapp_commerce_settings`, {
    method: 'POST',
    query: {
      is_cart_enabled: Boolean(input.isCartEnabled),
      is_catalog_visible: Boolean(input.isCatalogVisible),
    },
  });
}

export async function listQrCodes(account: AccountContext) {
  const phoneNumberId = requireValue(account.phoneNumberId, 'Phone number ID');
  const payload = await graphRequest(account, `${phoneNumberId}/message_qrdls`, {
    query: { fields: 'code,prefilled_message,deep_link_url,qr_image_url.format(PNG)' },
  });
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function createQrCode(account: AccountContext, prefilledMessage: unknown) {
  const phoneNumberId = requireValue(account.phoneNumberId, 'Phone number ID');
  const message = String(prefilledMessage || '').trim();
  if (!message) throw new AppError('Prefilled message is required', 400);
  return graphRequest(account, `${phoneNumberId}/message_qrdls`, {
    method: 'POST',
    body: JSON.stringify({ prefilled_message: message, generate_qr_image: 'PNG' }),
  });
}

export async function deleteQrCode(account: AccountContext, code: unknown) {
  const phoneNumberId = requireValue(account.phoneNumberId, 'Phone number ID');
  const qrCode = requireValue(code, 'QR code');
  return graphRequest(account, `${phoneNumberId}/message_qrdls/${encodeURIComponent(qrCode)}`, { method: 'DELETE' });
}

export async function listFlows(account: AccountContext) {
  const wabaId = requireValue(account.wabaId, 'WABA ID');
  const payload = await graphRequest(account, `${wabaId}/flows`, {
    query: { fields: 'id,name,status,categories,validation_errors,json_version,data_api_version,health_status' },
  });
  return Array.isArray(payload?.data) ? payload.data : [];
}

const FLOW_CATEGORIES = new Set([
  'SIGN_UP',
  'SIGN_IN',
  'APPOINTMENT_BOOKING',
  'LEAD_GENERATION',
  'CONTACT_US',
  'CUSTOMER_SUPPORT',
  'SURVEY',
  'OTHER',
]);

export async function createFlow(account: AccountContext, input: any = {}) {
  const wabaId = requireValue(account.wabaId, 'WABA ID');
  const name = String(input.name || '').trim();
  if (!name) throw new AppError('Flow name is required', 400);
  const requested = Array.isArray(input.categories) ? input.categories : [input.category || 'OTHER'];
  const categories = requested.map((value: unknown) => String(value || '').toUpperCase()).filter((value: string) => FLOW_CATEGORIES.has(value));
  if (!categories.length) categories.push('OTHER');

  const form = new FormData();
  form.set('name', name);
  form.set('categories', JSON.stringify(categories));
  if (String(input.endpointUri || '').trim()) form.set('endpoint_uri', String(input.endpointUri).trim());
  if (String(input.cloneFlowId || '').trim()) form.set('clone_flow_id', String(input.cloneFlowId).trim());

  return graphRequest(account, `${wabaId}/flows`, { method: 'POST', body: form });
}

export async function flowAction(account: AccountContext, flowId: unknown, action: 'publish' | 'deprecate' | 'delete') {
  const id = requireValue(flowId, 'Flow ID');
  if (action === 'delete') return graphRequest(account, encodeURIComponent(id), { method: 'DELETE' });
  return graphRequest(account, `${encodeURIComponent(id)}/${action}`, { method: 'POST' });
}

export const businessToolCapabilities = {
  businessProfile: true,
  commerceSettings: true,
  qrCodes: true,
  flows: true,
  catalogItemManagement: false,
  catalogItemManagementReason:
    'Product/item CRUD belongs to the Meta catalog/Commerce APIs and needs additional catalog/business asset permissions. The current WhatsApp permissions can control catalog visibility/cart behavior and send catalog messages, but not safely edit the catalog inventory itself.',
};
