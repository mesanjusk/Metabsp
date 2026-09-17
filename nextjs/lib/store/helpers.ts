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
