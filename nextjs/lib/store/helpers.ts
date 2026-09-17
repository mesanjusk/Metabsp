import crypto from 'crypto';

export function storeSlug(value: unknown, fallback = 'store') {
  return String(value || fallback).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || fallback;
}

export function rupeesToPaise(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

export function cleanImages(value: unknown) {
  const input = Array.isArray(value) ? value : String(value || '').split(/[\n,]/);
  return input.map((item) => String(item).trim()).filter((item) => /^https:\/\//i.test(item)).slice(0, 8);
}

export function inquiryNumber() {
  return `ENQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export const STORE_SUBDOMAIN_BASE = String(process.env.STORE_SUBDOMAIN_BASE || 'store.meta.sanjusk.in').toLowerCase();
export const STORE_DOMAIN_CNAME_TARGET = String(process.env.STORE_DOMAIN_CNAME_TARGET || 'metabsp.onrender.com').toLowerCase();

export function normalizeStoreDomain(value: unknown) {
  let input = String(value || '').trim().toLowerCase();
  if (!input) return '';
  input = input.replace(/^https?:\/\//, '').split('/')[0].replace(/:\d+$/, '').replace(/\.$/, '');
  if (input.length > 253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(input)) return '';
  return input;
}

export function publicStoreUrls(slug: string, customDomain = '', domainStatus = 'none') {
  const safeSlug = storeSlug(slug);
  return {
    publicPath: `/shop/${safeSlug}`,
    publicUrl: `https://meta.sanjusk.in/shop/${safeSlug}`,
    subdomainUrl: `https://${safeSlug}.${STORE_SUBDOMAIN_BASE}`,
    customDomainUrl: customDomain && domainStatus === 'active' ? `https://${customDomain}` : '',
  };
}
