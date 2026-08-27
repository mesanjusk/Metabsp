import axios from 'axios';
import AppError from '../utils/AppError';
import Message from '../models/Message';
import CampaignMessageStatus from '../models/CampaignMessageStatus';
import { validateWhatsAppConfig, classifyWhatsAppApiError } from '../services/whatsappHealthService';

// Ported from backend/src/controllers/whatsappController.js (lines ~1-305):
// callWhatsAppMessagesApi, saveAndEmitMessage, dispatchTextMessage,
// dispatchTemplateMessage, dispatchMediaMessage. These are pure
// request-driven functions — no serverless incompatibility — reused
// unchanged in shape here, and by the always-on host's BullMQ worker
// (which still imports its OWN copy from backend/src/controllers, per
// AS-1 leaving that host's code untouched).
export const normalizePhone = (v: unknown) => String(v || '').replace(/\D/g, '');

const ensureWhatsAppMessagingConfig = (config: any) => {
  const validated = validateWhatsAppConfig(config || {});
  if (!validated.ok) throw new AppError('Missing WhatsApp configuration', 400);
  return validated;
};

const normalizeWhatsAppApiError = (error: any, fallbackMessage = 'WhatsApp API request failed') => {
  const normalized = classifyWhatsAppApiError(error);
  const statusCode = normalized.code === 'INVALID_CONFIG' ? 400 : normalized.code === 'TOKEN_EXPIRED' ? 401 : 502;

  const sanitizedMessage =
    normalized.code === 'TOKEN_EXPIRED'
      ? 'WhatsApp authorization failed'
      : normalized.code === 'INVALID_CONFIG'
      ? 'Missing WhatsApp configuration'
      : fallbackMessage;

  return new AppError(sanitizedMessage, statusCode);
};

export const callWhatsAppMessagesApi = async (payload: unknown, accountContext: any, { fallbackMessage }: { fallbackMessage?: string } = {}) => {
  const { accessToken, graphVersion, phoneNumberId } = ensureWhatsAppMessagingConfig(accountContext);

  try {
    const response = await axios.post(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    throw normalizeWhatsAppApiError(error, fallbackMessage || 'Failed to send WhatsApp message');
  }
};

export const saveAndEmitMessage = async (payload: any) => {
  if (payload.messageId) {
    const existing = await Message.findOne({
      messageId: payload.messageId,
      ...(payload.whatsappAccountId ? { whatsappAccountId: payload.whatsappAccountId } : {}),
    }).lean();
    if (existing) return { message: existing, isDuplicate: true };
  }

  const savedMessage: any = await Message.create(payload);
  return { message: savedMessage, isDuplicate: false };
};

export const dispatchTextMessage = async ({
  accountContext,
  userId,
  to,
  body,
  campaignId = '',
}: {
  accountContext: any;
  userId: string;
  to: string;
  body: string;
  campaignId?: string;
}) => {
  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) throw new AppError('Invalid recipient number', 400);

  const data = await callWhatsAppMessagesApi(
    { messaging_product: 'whatsapp', to: normalizedTo, type: 'text', text: { body } },
    accountContext,
    { fallbackMessage: 'Failed to send WhatsApp text message' }
  );

  const messageId = data?.messages?.[0]?.id || '';
  await saveAndEmitMessage({
    userId,
    whatsappAccountId: accountContext?.account?._id,
    fromMe: true,
    from: accountContext.phoneNumberId || '',
    to: normalizedTo,
    message: body,
    body,
    text: body,
    timestamp: new Date(),
    time: new Date(),
    status: 'sent',
    direction: 'outgoing',
    type: 'text',
    messageId,
  });

  if (campaignId && messageId) {
    await CampaignMessageStatus.updateOne(
      { userId, whatsappAccountId: accountContext?.account?._id, messageId, status: 'sent' },
      { $setOnInsert: { userId, whatsappAccountId: accountContext?.account?._id, messageId, status: 'sent', timestamp: new Date(), campaignId } },
      { upsert: true }
    );
  }

  return data;
};

export const dispatchTemplateMessage = async ({
  accountContext,
  userId,
  to,
  templateName,
  language = 'en_US',
  components = [],
  campaignId = '',
}: {
  accountContext: any;
  userId: string;
  to: string;
  templateName: string;
  language?: string;
  components?: unknown[];
  campaignId?: string;
}) => {
  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) throw new AppError('Invalid recipient number', 400);

  const data = await callWhatsAppMessagesApi(
    {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'template',
      template: { name: templateName, language: { code: language }, components },
    },
    accountContext,
    { fallbackMessage: 'Failed to send WhatsApp template message' }
  );

  const messageId = data?.messages?.[0]?.id || '';
  await saveAndEmitMessage({
    userId,
    whatsappAccountId: accountContext?.account?._id,
    fromMe: true,
    from: accountContext.phoneNumberId || '',
    to: normalizedTo,
    message: templateName,
    body: templateName,
    text: templateName,
    timestamp: new Date(),
    time: new Date(),
    status: 'sent',
    direction: 'outgoing',
    type: 'template',
    messageId,
  });

  if (campaignId && messageId) {
    await CampaignMessageStatus.updateOne(
      { userId, whatsappAccountId: accountContext?.account?._id, messageId, status: 'sent' },
      { $setOnInsert: { userId, whatsappAccountId: accountContext?.account?._id, messageId, status: 'sent', timestamp: new Date(), campaignId } },
      { upsert: true }
    );
  }

  return data;
};

export const dispatchMediaMessage = async ({
  accountContext,
  userId,
  to,
  type,
  link,
  caption = '',
  filename = '',
}: {
  accountContext: any;
  userId: string;
  to: string;
  type: string;
  link: string;
  caption?: string;
  filename?: string;
}) => {
  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) throw new AppError('Invalid recipient number', 400);

  const payload: any = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type,
    [type]: { link, ...(caption ? { caption } : {}), ...(filename && type === 'document' ? { filename } : {}) },
  };

  const data = await callWhatsAppMessagesApi(payload, accountContext, { fallbackMessage: 'Failed to send WhatsApp media message' });

  const messageId = data?.messages?.[0]?.id || '';
  await saveAndEmitMessage({
    userId,
    whatsappAccountId: accountContext?.account?._id,
    fromMe: true,
    from: accountContext.phoneNumberId || '',
    to: normalizedTo,
    message: caption || link,
    body: caption || link,
    text: caption || '',
    mediaUrl: link,
    caption,
    filename,
    timestamp: new Date(),
    time: new Date(),
    status: 'sent',
    direction: 'outgoing',
    type,
    messageId,
  });

  return data;
};
