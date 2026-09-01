import { describe, expect, it, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

const req = (url: string, init: { method?: string; origin?: string } = {}) =>
  new NextRequest(`https://app.example${url}`, {
    method: init.method || 'GET',
    headers: init.origin ? { origin: init.origin } : {},
  });

describe('CORS policy', () => {
  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = 'https://app.example,https://console.example';
  });

  it('opens /api/v1 to any origin — an API key cannot be attached by a browser automatically', () => {
    const res = middleware(req('/api/v1/send-text', { method: 'POST', origin: 'https://customer.example' }));
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    // Credentials must stay off, which is what makes the wildcard safe.
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('answers a preflight itself, since it never reaches a route handler', () => {
    const res = middleware(req('/api/v1/send-text', { method: 'OPTIONS', origin: 'https://customer.example' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-headers')).toContain('X-Api-Key');
  });

  it('allows a configured origin to call the dashboard API with credentials', () => {
    const res = middleware(req('/api/whatsapp/contacts', { origin: 'https://console.example' }));
    expect(res.headers.get('access-control-allow-origin')).toBe('https://console.example');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('vary')).toBe('Origin');
  });

  it('gives an unlisted origin no CORS grant at all on the dashboard API', () => {
    const res = middleware(req('/api/whatsapp/contacts', { origin: 'https://evil.example' }));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('does not reflect an origin that merely starts with an allowed one', () => {
    const res = middleware(req('/api/whatsapp/contacts', { origin: 'https://app.example.attacker.test' }));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('leaves the Meta webhook alone — Meta sends no Origin and must never be origin-gated', () => {
    const res = middleware(req('/webhook', { method: 'POST' }));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
