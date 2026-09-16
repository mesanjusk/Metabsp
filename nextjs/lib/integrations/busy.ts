import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { getRedisConnection } from '@/lib/db/redis';
import ApiKey, { hashApiKey } from '@/lib/models/ApiKey';
import User from '@/lib/models/User';
import AppError from '@/lib/utils/AppError';
import { checkAuthRateLimit, checkUserRateLimit } from '@/lib/http/rateLimit';
import { loadWhatsAppAccountForUserById } from '@/lib/services/whatsappAccountService';
import { dispatchTextMessage, dispatchTemplateMessage } from '@/lib/whatsapp/dispatch';
import { checkWhatsApp24hWindow } from '@/lib/whatsapp/twentyFourHourGuard';
import type { BusyConfig } from './busyConfig';

export function parseBusyInput(params: URLSearchParams, config: BusyConfig) {
  for (const key of ['token', 'phone', 'mobileNos', 'message', 'text', 'invoice_url', 'param1', 'param2', 'param3']) {
    if (params.getAll(key).length > 1) throw new AppError(`Pass ${key} only once.`, 400);
  }
  const rawPhone = (params.get('phone') || params.get('mobileNos') || '').trim();
  if (!/^[+\d()\s-]+$/.test(rawPhone)) throw new AppError('Send one mobile number per request, with country code.', 400);
  let phone = rawPhone.replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (config.addIndiaCode && phone.length === 10) phone = `91${phone}`;
  if (!/^[1-9]\d{7,14}$/.test(phone)) throw new AppError('Use a valid mobile number with country code.', 400);
  const message = (params.get('message') || params.get('text') || '').trim();
  if (message.length > 4096) throw new AppError('Message must be at most 4096 characters.', 400);
  const invoiceUrl = (params.get('invoice_url') || message.match(/https:\/\/[^\s<>]+/i)?.[0] || '').trim();
  const fields: Record<string, string> = { message, invoice_url: invoiceUrl };
  for (const name of ['param1', 'param2', 'param3']) fields[name] = (params.get(name) || '').trim();
  if (config.mode === 'text' && !message) throw new AppError('Message is required.', 400);
  const components: any[] = [];
  for (const binding of config.bindings || []) {
    const value = fields[binding.source];
    if (!value) throw new AppError(`Missing ${binding.source} for ${binding.component} ${binding.variable}.`, 400);
    if (value.length > 4096) throw new AppError('Template values must be at most 4096 characters.', 400);
    let parameter: any;
    if (binding.type === 'document') {
      let url: URL;
      try { url = new URL(value); } catch { throw new AppError('Invoice URL must be a public HTTPS PDF link.', 400); }
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new AppError('Invoice URL must be a public HTTPS PDF link.', 400);
      parameter = { type: 'document', document: { link: value, filename: 'Invoice.pdf' } };
    } else {
      // Meta text parameters cannot contain newlines/tabs. URLSearchParams
      // decodes percent-encoded BUSY text once; never decode it a second time.
      parameter = { type: 'text', text: value.replace(/\s+/g, ' ') };
      if (binding.named) parameter.parameter_name = binding.variable;
    }
    let part = components.find(p => p.type === binding.component);
    if (!part) { part = { type: binding.component, parameters: [] }; components.push(part); }
    part.parameters.push(parameter);
  }
  return { phone, message, components };
}

async function cacheCommand<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Cache timeout')), 2500);
    })]);
  } catch { throw new AppError('BUSY retry protection is temporarily unavailable. No new send was started; try again later.', 503); }
  finally { if (timer) clearTimeout(timer); }
}

export async function sendFromBusy(req: NextRequest) {
  if (req.url.length > 20000) throw new AppError('Request is too long. Send a shorter message or PDF link.', 414);
  if (/prefetch|preview/i.test(`${req.headers.get('purpose') || ''} ${req.headers.get('sec-purpose') || ''}`))
    throw new AppError('Link previews cannot send messages.', 400);
  const params = req.nextUrl.searchParams;
  const token = params.get('token') || '';
  if (!/^busy_[a-f0-9]{56}$/.test(token)) throw new AppError('A valid BUSY integration token is required.', 401);
  if (!await checkAuthRateLimit(req, { scope: 'busy', windowMs: 60000, maxRequests: 120 }))
    throw new AppError('Too many BUSY requests. Try again in a minute.', 429);
  await connectDB();
  const key: any = await ApiKey.findOne({ keyHash: hashApiKey(token), scope: 'busy', isActive: true }).lean();
  if (!key?.busyConfig) throw new AppError('Invalid or revoked BUSY token.', 401);
  const owner: any = await User.findById(key.userId).select('isActive').lean();
  if (!owner || owner.isActive === false) throw new AppError('The integration owner is no longer active.', 403);
  if (!await checkUserRateLimit(`busy:${key._id}`, { windowMs: 60000, maxRequests: 60 }))
    throw new AppError('BUSY limit reached. Try again in a minute.', 429);
  const config: BusyConfig = key.busyConfig;
  const accountContext = await loadWhatsAppAccountForUserById(String(key.userId), config.accountId);
  if (accountContext.phoneNumberId !== config.phoneNumberId)
    throw new AppError('The connected sender changed. Create a new BUSY integration.', 409);
  const { phone, message, components } = parseBusyInput(params, config);
  if (config.mode === 'text') {
    const window = await checkWhatsApp24hWindow({ messageType: 'text', to: phone,
      whatsappAccountId: config.accountId, userId: String(key.userId) });
    if (!window.allowed) throw new AppError('Outside the 24-hour reply window. Create a BUSY integration using an approved template.', 403);
  } else if (config.mode !== 'template' || !config.template || !config.language) {
    throw new AppError('BUSY template configuration is incomplete. Create a new integration.', 409);
  }

  // A URL client may retry after a timeout. Reserve before contacting Meta;
  // identical sends are suppressed for two minutes, including uncertain sends.
  // Cache failure stops the send rather than silently losing retry protection.
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({
    id: String(key._id), phone, payload: config.mode === 'text' ? message : components,
  })).digest('hex');
  let redis: ReturnType<typeof getRedisConnection>;
  try { redis = getRedisConnection(); }
  catch { throw new AppError('BUSY retry protection is unavailable. Try again later.', 503); }
  const cacheKey = `busy:send:${fingerprint}`;
  const reserved = await cacheCommand(redis.set(cacheKey, 'pending', 'EX', 120, 'NX'));
  if (!reserved) {
    const previous = await cacheCommand(redis.get(cacheKey));
    if (previous && previous !== 'pending') return { success: true, duplicate: true, message: 'Already accepted', data: JSON.parse(previous) };
    throw new AppError('This send is in progress or its delivery is uncertain. Check the inbox before retrying after two minutes.', 409);
  }
  const data = config.mode === 'text'
    ? await dispatchTextMessage({ accountContext, userId: String(key.userId), to: phone, body: message })
    : await dispatchTemplateMessage({ accountContext, userId: String(key.userId), to: phone,
      templateName: config.template!, language: config.language!, components });
  // Return only the acceptance ID, not account credentials or raw provider data.
  const result = { messageId: String(data?.messages?.[0]?.id || '') };
  try { await cacheCommand(redis.set(cacheKey, JSON.stringify(result), 'EX', 120)); } catch { /* Retain the pending reservation. */ }
  ApiKey.updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});
  return { success: true, message: 'Message accepted by WhatsApp', data: result };
}
