import { resolveCname, resolveTxt } from 'node:dns/promises';
import { STORE_DOMAIN_CNAME_TARGET } from './helpers';

async function hasVerificationTxt(domain: string, token: string) {
  try {
    const records = await resolveTxt(`_metabsp-verification.${domain}`);
    return records.some((parts) => parts.join('') === token);
  } catch { return false; }
}

async function hasStoreCname(domain: string) {
  try {
    const records = await resolveCname(domain);
    return records.some((value) => value.replace(/\.$/, '').toLowerCase() === STORE_DOMAIN_CNAME_TARGET);
  } catch { return false; }
}

export async function verifyStoreDns(domain: string, token: string) {
  const [txt, cname] = await Promise.all([hasVerificationTxt(domain, token), hasStoreCname(domain)]);
  return { txt, cname, valid: txt && cname };
}

async function renderRequest(path: string, init: RequestInit = {}) {
  const apiKey = process.env.RENDER_API_KEY;
  const serviceId = process.env.RENDER_SERVICE_ID;
  if (!apiKey || !serviceId) return null;
  return fetch(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  });
}

export async function provisionRenderDomain(domain: string) {
  const created = await renderRequest('/custom-domains', { method: 'POST', body: JSON.stringify({ name: domain }) });
  if (!created) return { configured: false, active: false, message: 'Hosting automation is not configured yet.' };
  if (!created.ok && created.status !== 409) return { configured: true, active: false, message: `Render rejected the domain (${created.status}).` };
  const status = await renderRequest(`/custom-domains/${encodeURIComponent(domain)}`);
  if (!status?.ok) return { configured: true, active: false, message: 'Domain added to hosting; certificate verification is still pending.' };
  const data: any = await status.json().catch(() => ({}));
  const active = data?.verificationStatus === 'verified' || data?.verified === true;
  return { configured: true, active, message: active ? '' : 'DNS is correct. Render is issuing the HTTPS certificate; retry verification in a few minutes.' };
}
