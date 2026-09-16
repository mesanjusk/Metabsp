import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const keyFind = vi.fn();
const updateOne = vi.fn(async () => undefined);
const ownerFind = vi.fn();
const accountLoader = vi.fn();
const authLimit = vi.fn(async () => true);
const keyLimit = vi.fn(async () => true);
const textSend = vi.fn(async (_args: any): Promise<any> => ({ messages: [{ id: 'wamid.busy' }] }));
const templateSend = vi.fn(async (_args: any): Promise<any> => ({ messages: [{ id: 'wamid.template' }] }));
const windowCheck = vi.fn(async () => ({ allowed: true }));
const cache = new Map<string, string>();
const cacheSet = vi.fn(async (key: string, value: string, _ex: string, _ttl: number, nx?: string) => {
  if (nx === 'NX' && cache.has(key)) return null;
  cache.set(key, value); return 'OK';
});
const cacheGet = vi.fn(async (key: string) => cache.get(key) || null);

vi.mock('@/lib/models/ApiKey', async () => {
  const actual: any = await vi.importActual('@/lib/models/ApiKey');
  return { ...actual, default: { findOne: keyFind, updateOne } };
});
vi.mock('@/lib/models/User', () => ({ default: { findById: ownerFind } }));
vi.mock('@/lib/services/whatsappAccountService', () => ({ loadWhatsAppAccountForUserById: accountLoader }));
vi.mock('@/lib/http/rateLimit', () => ({ checkAuthRateLimit: authLimit, checkUserRateLimit: keyLimit }));
vi.mock('@/lib/whatsapp/dispatch', () => ({ dispatchTextMessage: textSend, dispatchTemplateMessage: templateSend }));
vi.mock('@/lib/whatsapp/twentyFourHourGuard', () => ({ checkWhatsApp24hWindow: windowCheck }));
vi.mock('@/lib/db/redis', () => ({ getRedisConnection: () => ({ set: cacheSet, get: cacheGet }) }));

const { GET, HEAD } = await import('@/app/api/integrations/busy/send/route');
const { busyTemplateBindings, busySetupUrl } = await import('@/lib/integrations/busyConfig');
const { ApiKey, hashApiKey } = await import('@/lib/models/ApiKey');
const token = 'busy_' + 'a'.repeat(56);
const accountId = 'a'.repeat(24);
let record: any;
const request = (input: Record<string, string> = {}, headers: Record<string, string> = {}) =>
  new NextRequest(`https://example.test/api/integrations/busy/send?${new URLSearchParams({ token, phone: '9876543210', message: 'Invoice ₹100 & tax + delivery', ...input })}`, { headers });

beforeEach(() => {
  vi.clearAllMocks(); cache.clear();
  record = { _id: 'key1', userId: 'user1', scope: 'busy', busyConfig: {
    accountId, phoneNumberId: 'PN1', mode: 'text', addIndiaCode: true, bindings: [], sender: '919000000000',
  } };
  keyFind.mockImplementation(() => ({ lean: async () => record }));
  ownerFind.mockImplementation(() => ({ select: () => ({ lean: async () => ({ isActive: true }) }) }));
  accountLoader.mockResolvedValue({ phoneNumberId: 'PN1', account: { _id: accountId } });
  authLimit.mockResolvedValue(true); keyLimit.mockResolvedValue(true);
  textSend.mockResolvedValue({ messages: [{ id: 'wamid.busy' }] });
  templateSend.mockResolvedValue({ messages: [{ id: 'wamid.template' }] });
  windowCheck.mockResolvedValue({ allowed: true });
  cacheSet.mockImplementation(async (key, value, _ex, _ttl, nx) => {
    if (nx === 'NX' && cache.has(key)) return null;
    cache.set(key, value); return 'OK';
  });
});

describe('BUSY URL connector', () => {
  it('uses a separate hashed credential and pins the sender to its configuration', async () => {
    const res = await GET(request({ accountId: 'someone-else', senderid: 'PN-other' }));
    expect(res.status).toBe(200);
    expect(keyFind).toHaveBeenCalledWith({ keyHash: hashApiKey(token), scope: 'busy', isActive: true });
    expect(accountLoader).toHaveBeenCalledWith('user1', accountId);
    expect(textSend).toHaveBeenCalledWith(expect.objectContaining({ to: '919876543210', userId: 'user1' }));
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('does not accept a general API key in the query', async () => {
    expect((await GET(request({ token: 'mbsp_' + 'a'.repeat(56) }))).status).toBe(401);
    expect(keyFind).not.toHaveBeenCalled(); expect(textSend).not.toHaveBeenCalled();
  });
  it('refuses revoked tokens and inactive or deleted owners', async () => {
    const saved = record; record = null;
    expect((await GET(request())).status).toBe(401);
    record = saved;
    ownerFind.mockReturnValue({ select: () => ({ lean: async () => null }) });
    expect((await GET(request())).status).toBe(403);
    ownerFind.mockReturnValue({ select: () => ({ lean: async () => ({ isActive: false }) }) });
    expect((await GET(request())).status).toBe(403);
    expect(textSend).not.toHaveBeenCalled();
  });
  it('fails if the pinned sender was replaced, never switches to the new number', async () => {
    accountLoader.mockResolvedValue({ phoneNumberId: 'PN2' });
    expect((await GET(request())).status).toBe(409);
    expect(textSend).not.toHaveBeenCalled();
  });
  it('keeps encoded Hindi, ampersands, plus signs and percent literals intact', async () => {
    const message = 'नमस्ते! बिल ₹100 & टैक्स + 5% — %26';
    expect((await GET(request({ message }))).status).toBe(200);
    expect(textSend).toHaveBeenCalledWith(expect.objectContaining({ body: message }));
  });
  it('only adds India code when explicitly configured', async () => {
    record.busyConfig.addIndiaCode = false;
    await GET(request({ phone: '+44 (20) 7946-0018' }));
    expect(textSend).toHaveBeenCalledWith(expect.objectContaining({ to: '442079460018' }));
  });
  it('rejects bulk recipients, malformed phones, missing messages and repeated parameters', async () => {
    for (const phone of ['9876543210,9876543211', '123', 'hello']) expect((await GET(request({ phone }))).status).toBe(400);
    expect((await GET(request({ message: '' }))).status).toBe(400);
    expect((await GET(new NextRequest(request().url + '&phone=919876543211'))).status).toBe(400);
    expect(textSend).not.toHaveBeenCalled();
  });
  it('enforces the customer reply window for free text', async () => {
    windowCheck.mockResolvedValue({ allowed: false });
    const res = await GET(request());
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain('approved template');
    expect(textSend).not.toHaveBeenCalled();
  });
  it('sends the configured template and maps PDF, named variables and extra fields', async () => {
    record.busyConfig = { ...record.busyConfig, mode: 'template', template: 'invoice_ready', language: 'hi', bindings: [
      { component: 'header', variable: 'document', type: 'document', source: 'invoice_url' },
      { component: 'body', variable: 'customer', type: 'text', named: true, source: 'param1' },
      { component: 'body', variable: 'summary', type: 'text', named: true, source: 'message' },
    ] };
    const res = await GET(request({ param1: 'Sanju', message: 'Invoice\nhttps://example.test/invoice.pdf', template: 'hijack', language: 'xx' }));
    expect(res.status).toBe(200);
    expect(templateSend).toHaveBeenCalledWith(expect.objectContaining({ templateName: 'invoice_ready', language: 'hi', components: [
      { type: 'header', parameters: [{ type: 'document', document: { link: 'https://example.test/invoice.pdf', filename: 'Invoice.pdf' } }] },
      { type: 'body', parameters: [{ type: 'text', parameter_name: 'customer', text: 'Sanju' }, { type: 'text', parameter_name: 'summary', text: 'Invoice https://example.test/invoice.pdf' }] },
    ] }));
    expect(windowCheck).not.toHaveBeenCalled();
  });
  it('rejects missing variables and unsafe document schemes before sending', async () => {
    record.busyConfig = { ...record.busyConfig, mode: 'template', template: 'invoice', language: 'en', bindings: [
      { component: 'header', variable: 'document', type: 'document', source: 'invoice_url' },
    ] };
    expect((await GET(request())).status).toBe(400);
    expect((await GET(request({ invoice_url: 'file:///private/invoice.pdf' }))).status).toBe(400);
    expect(templateSend).not.toHaveBeenCalled();
  });
  it('rate-limits separately by integration and returns Retry-After', async () => {
    keyLimit.mockResolvedValue(false);
    const res = await GET(request());
    expect(res.status).toBe(429); expect(res.headers.get('retry-after')).toBe('60');
    expect(keyLimit).toHaveBeenCalledWith('busy:key1', expect.any(Object));
    expect(textSend).not.toHaveBeenCalled();
  });
  it('HEAD and link previews never send or look up a token', async () => {
    expect((await HEAD()).status).toBe(405);
    expect((await GET(request({}, { 'sec-purpose': 'prefetch' }))).status).toBe(400);
    expect(keyFind).not.toHaveBeenCalled(); expect(textSend).not.toHaveBeenCalled();
  });
  it('reuses the acceptance ID on an identical retry without sending twice', async () => {
    await GET(request());
    const res = await GET(request());
    expect(await res.json()).toMatchObject({ success: true, duplicate: true, data: { messageId: 'wamid.busy' } });
    expect(textSend).toHaveBeenCalledTimes(1);
  });
  it('blocks concurrent retries while the first send is pending', async () => {
    let finish!: (value: any) => void;
    textSend.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const first = GET(request());
    await vi.waitFor(() => expect(textSend).toHaveBeenCalledTimes(1));
    expect((await GET(request())).status).toBe(409);
    finish({ messages: [{ id: 'wamid.1' }] });
    expect((await first).status).toBe(200);
  });
  it('retains the reservation after an uncertain provider error', async () => {
    textSend.mockRejectedValue(new Error('provider connection dropped'));
    expect((await GET(request())).status).toBe(502);
    expect((await GET(request())).status).toBe(409);
    expect(textSend).toHaveBeenCalledTimes(1);
  });
  it('does not send if retry protection is unavailable', async () => {
    cacheSet.mockRejectedValue(new Error('cache down'));
    expect((await GET(request())).status).toBe(503);
    expect(textSend).not.toHaveBeenCalled();
  });
});

describe('BUSY setup', () => {
  it('generates a send-only credential without storing its plaintext', async () => {
    const create = vi.fn(async (value: any) => value);
    const { rawKey, doc } = await (ApiKey as any).generateBusy.call({ create }, 'u1', 'Books', { accountId });
    expect(rawKey).toMatch(/^busy_[a-f0-9]{56}$/);
    expect(doc).toMatchObject({ scope: 'busy', keyHash: hashApiKey(rawKey), busyConfig: { accountId } });
    expect(JSON.stringify(doc)).not.toContain(rawKey);
  });
  it('orders positional variables numerically and removes repeated placeholders', () => {
    const fields = busyTemplateBindings({ status: 'APPROVED', components: [{ type: 'BODY', text: '{{2}} {{1}} {{2}}' }] });
    expect(fields.map(f => f.variable)).toEqual(['1', '2']);
  });
  it('rejects unapproved and unsupported templates', () => {
    expect(() => busyTemplateBindings({ status: 'PENDING' })).toThrow(/approved/);
    expect(() => busyTemplateBindings({ status: 'APPROVED', components: [{ type: 'HEADER', format: 'VIDEO' }] })).toThrow(/PDF/);
    expect(() => busyTemplateBindings({ status: 'APPROVED', components: [{ type: 'BUTTONS', buttons: [{ type: 'URL', url: 'https://example.test/{{1}}' }] }] })).toThrow(/dynamic/);
  });
  it('uses BUSY substitution names and only adds the configured extra parameters', () => {
    const url = busySetupUrl('https://example.test', [{ component: 'body', variable: '1', type: 'text', source: 'param2' }]);
    expect(url).toContain('token=BUSY_TOKEN&phone=BUSY_MOBILE&message=BUSY_MESSAGE&param2=BUSY_PARAM2');
    expect(url).not.toContain('param1');
  });
});
