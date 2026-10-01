import AppError from '@/lib/utils/AppError';
import RcsMessage from '@/lib/models/RcsMessage';
import { checkRcsCapabilities, normalizeRcsPhone, sendRcsText } from '@/lib/rcs/googleRbm';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { checkWhatsApp24hWindow } from '@/lib/whatsapp/twentyFourHourGuard';
import { dispatchTextMessage } from '@/lib/whatsapp/dispatch';

const TRAFFIC_TYPES = new Set([
  'AUTHENTICATION',
  'TRANSACTION',
  'PROMOTION',
  'SERVICEREQUEST',
  'ACKNOWLEDGEMENT',
]);

export function normalizeTrafficType(value: unknown) {
  const trafficType = String(value || 'TRANSACTION').toUpperCase();
  if (!TRAFFIC_TYPES.has(trafficType)) {
    throw new AppError('Invalid RCS message traffic type', 400);
  }
  return trafficType;
}

async function smsFallback(phone: string, text: string) {
  const url = String(process.env.RCS_SMS_FALLBACK_URL || '').trim();
  if (!url) throw new AppError('SMS fallback is selected but no SMS adapter is configured', 409);

  const token = String(process.env.RCS_SMS_FALLBACK_TOKEN || '').trim();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ to: phone, text, source: 'rcs-fallback' }),
  });

  if (!response.ok) {
    throw new AppError('SMS fallback provider rejected the message', 502);
  }

  return response.json().catch(() => ({}));
}

export async function deliverRcsWithFallback({
  authed,
  agent,
  phone,
  text,
  trafficType,
  suggestions = [],
}: {
  authed: any;
  agent: any;
  phone: string;
  text: string;
  trafficType: string;
  suggestions?: unknown[];
}) {
  const normalizedPhone = normalizeRcsPhone(phone);
  const cleanText = String(text || '').trim();
  if (!cleanText) throw new AppError('Message text is required', 400);
  if (cleanText.length > 3072) throw new AppError('RCS text messages can be at most 3072 characters', 400);

  const normalizedTrafficType = normalizeTrafficType(trafficType);
  const capability = await checkRcsCapabilities({
    agentId: String(agent.agentId),
    region: agent.region,
    phone: normalizedPhone,
  });

  if (capability.reachable) {
    const sent = await sendRcsText({
      agentId: String(agent.agentId),
      region: agent.region,
      phone: normalizedPhone,
      text: cleanText,
      trafficType: normalizedTrafficType,
      suggestions,
    });

    await RcsMessage.create({
      userId: authed.id,
      tenantId: authed.tenantId || null,
      agentId: agent.agentId,
      phone: normalizedPhone,
      direction: 'outgoing',
      channel: 'rcs',
      kind: 'message',
      messageId: sent.messageId,
      text: cleanText,
      trafficType: normalizedTrafficType,
      status: 'sent',
      raw: sent.data,
    });

    return { channel: 'rcs', capability, messageId: sent.messageId, data: sent.data };
  }

  if (agent.fallbackMode === 'whatsapp') {
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });
    if (!accountContext) {
      throw new AppError('RCS is unavailable and no WhatsApp account is connected for fallback', 409);
    }

    const windowCheck = await checkWhatsApp24hWindow({
      messageType: 'text',
      to: normalizedPhone,
      whatsappAccountId: accountContext?.account?._id,
      userId: authed.id,
    });

    if (!windowCheck.allowed) {
      return {
        channel: 'none',
        capability,
        fallbackRequired: true,
        fallback: 'whatsapp',
        code: 'WHATSAPP_TEMPLATE_REQUIRED',
        lastCustomerMessageAt: windowCheck.lastUserMessageAt,
      };
    }

    const data = await dispatchTextMessage({
      accountContext,
      userId: authed.id,
      to: normalizedPhone,
      body: cleanText,
    });

    await RcsMessage.create({
      userId: authed.id,
      tenantId: authed.tenantId || null,
      agentId: agent.agentId,
      phone: normalizedPhone,
      direction: 'outgoing',
      channel: 'whatsapp',
      kind: 'fallback',
      text: cleanText,
      trafficType: normalizedTrafficType,
      status: 'fallback_sent',
      raw: data,
    });

    return { channel: 'whatsapp', capability, fallback: true, data };
  }

  if (agent.fallbackMode === 'sms') {
    const data = await smsFallback(normalizedPhone, cleanText);
    await RcsMessage.create({
      userId: authed.id,
      tenantId: authed.tenantId || null,
      agentId: agent.agentId,
      phone: normalizedPhone,
      direction: 'outgoing',
      channel: 'sms',
      kind: 'fallback',
      text: cleanText,
      trafficType: normalizedTrafficType,
      status: 'fallback_sent',
      raw: data,
    });
    return { channel: 'sms', capability, fallback: true, data };
  }

  return {
    channel: 'none',
    capability,
    fallbackRequired: true,
    fallback: 'none',
    code: 'RCS_UNREACHABLE',
  };
}
