import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const requireApiKey = vi.fn();
const loadActiveWhatsAppAccountForUser = vi.fn();
const checkUserRateLimit = vi.fn(async () => true);
const dispatchTextMessage = vi.fn(async (_args: any): Promise<any> => ({ messages: [{ id: 'wamid.1' }] }));
const checkWhatsApp24hWindow = vi.fn(async () => ({ allowed: true, isInsideWindow: true, lastUserMessageAt: new Date() }));

vi.mock('@/lib/auth/apiKey', () => ({ requireApiKey }));
vi.mock('@/lib/services/whatsappAccountService', () => ({ loadActiveWhatsAppAccountForUser }));
vi.mock('@/lib/http/rateLimit', () => ({ checkUserRateLimit }));
vi.mock('@/lib/whatsapp/dispatch', () => ({ dispatchTextMessage, normalizePhone: (v: any) => String(v || '') }));
vi.mock('@/lib/whatsapp/twentyFourHourGuard', () => ({ checkWhatsApp24hWindow }));

const { POST } = await import('@/app/api/v1/send-text/route');

const post = (body: unknown) =>
  new NextRequest('https://example.test/api/v1/send-text', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer mbsp_key' },
    body: JSON.stringify(body),
  });

describe('POST /api/v1/send-text', () => {
  beforeEach(() => {
    requireApiKey.mockImplementation(async () => ({ userId: 'u1', tenantId: 't1', apiKeyId: 'k1' }));
    loadActiveWhatsAppAccountForUser.mockImplementation(async () => ({ account: { _id: 'acct-1' }, phoneNumberId: 'PN1' }));
    checkUserRateLimit.mockImplementation(async () => true);
    checkWhatsApp24hWindow.mockImplementation(async () => ({ allowed: true, isInsideWindow: true, lastUserMessageAt: new Date() }));
    dispatchTextMessage.mockClear();
  });

  it('sends when the key is valid and the window is open', async () => {
    const res = await POST(post({ phone: '919876543210', text: 'hello' }));
    expect(res.status).toBe(200);
    expect(dispatchTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', to: '919876543210', body: 'hello' })
    );
  });

  it('resolves the sending number from the key\'s owner, never from the request body', async () => {
    await POST(post({ phone: '919876543210', text: 'hello', accountId: 'someone-elses-account' }));
    expect(loadActiveWhatsAppAccountForUser).toHaveBeenCalledWith('u1');
    expect(dispatchTextMessage.mock.calls.at(0)?.[0]?.accountContext?.account?._id).toBe('acct-1');
  });

  it('rejects a missing phone or text with 400 before calling Meta', async () => {
    expect((await POST(post({ text: 'hello' }))).status).toBe(400);
    expect((await POST(post({ phone: '919876543210' }))).status).toBe(400);
    expect(dispatchTextMessage).not.toHaveBeenCalled();
  });

  it('returns 429 with Retry-After when the key exceeds its rate limit', async () => {
    checkUserRateLimit.mockImplementation(async () => false);
    const res = await POST(post({ phone: '919876543210', text: 'hello' }));

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
    expect(dispatchTextMessage).not.toHaveBeenCalled();
  });

  it('rate limits per API key, so one integration cannot exhaust another\'s budget', async () => {
    await POST(post({ phone: '919876543210', text: 'hello' }));
    expect(checkUserRateLimit).toHaveBeenCalledWith('apikey:k1', expect.any(Object));
  });

  it('answers 409, not a Meta error, when the key\'s owner has no connected number', async () => {
    loadActiveWhatsAppAccountForUser.mockImplementation(async () => {
      throw new Error('no account');
    });
    const res = await POST(post({ phone: '919876543210', text: 'hello' }));

    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/connect a number/i);
  });

  it('explains the 24-hour window instead of passing Meta\'s raw rejection through', async () => {
    checkWhatsApp24hWindow.mockImplementation(async () => ({ allowed: false, isInsideWindow: false, lastUserMessageAt: null }));
    const res = await POST(post({ phone: '919876543210', text: 'hello' }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('OUTSIDE_24H_WINDOW');
    expect(body.message).toMatch(/send-template/);
  });

  it('never leaks an internal error message to an API caller', async () => {
    dispatchTextMessage.mockImplementation(async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.5:27017');
    });
    const res = await POST(post({ phone: '919876543210', text: 'hello' }));
    const body = await res.json();

    expect(body.message).not.toContain('ECONNREFUSED');
    expect(body.message).not.toContain('10.0.0.5');
    expect(res.status).toBe(503);
  });

  it('does pass Meta\'s own error text through, which is what makes the API debuggable', async () => {
    dispatchTextMessage.mockImplementation(async () => {
      const error: any = new Error('Request failed');
      error.response = { status: 400, data: { error: { message: 'Template name does not exist', code: 132001 } } };
      throw error;
    });
    const res = await POST(post({ phone: '919876543210', text: 'hello' }));
    const body = await res.json();

    expect(body.message).toBe('Template name does not exist');
    expect(body.code).toBe(132001);
  });
});
