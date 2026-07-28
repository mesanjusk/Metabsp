import Message from '../models/Message';
import logger from '../utils/logger';

// Ported from backend/src/middleware/whatsapp24hGuard.js. The Express
// version inferred messageType from req.path; Route Handlers already know
// their own message type statically, so callers just pass it in directly
// instead of a path-sniffing helper.
const WINDOW_MS = 24 * 60 * 60 * 1000;

const normalizePhone = (value: unknown) => String(value || '').replace(/\D/g, '');

const buildIncomingFilter = ({ phone, contactId, conversationId }: { phone: string; contactId: string; conversationId: string }) => {
  const incomingDirectionFilters = [{ direction: 'incoming' }, { fromMe: false }];
  const identityFilters: any[] = [];

  if (phone) {
    const last10 = phone.slice(-10);
    identityFilters.push({ from: phone }, { from: `+${phone}` });
    if (last10 && last10 !== phone) {
      identityFilters.push({ from: last10 }, { from: `+${last10}` });
    }
  }

  if (contactId) {
    identityFilters.push({ customerId: contactId }, { customerUuid: contactId });
  }

  if (conversationId) {
    identityFilters.push({ customerId: conversationId }, { customerUuid: conversationId });
    const normalizedConversationPhone = normalizePhone(conversationId);
    if (normalizedConversationPhone) {
      identityFilters.push({ from: normalizedConversationPhone }, { from: `+${normalizedConversationPhone}` });
    }
  }

  if (!identityFilters.length) return null;
  return { $and: [{ $or: incomingDirectionFilters }, { $or: identityFilters }] };
};

export interface TwentyFourHourCheckResult {
  allowed: boolean;
  isInsideWindow: boolean;
  lastUserMessageAt: Date | null;
}

// Returns {allowed:false} for a non-template send outside the 24h window —
// callers should respond 403 in that case, same as the original.
export async function checkWhatsApp24hWindow({
  messageType,
  to,
  contactId,
  conversationId,
  whatsappAccountId,
  userId,
}: {
  messageType: string;
  to?: string;
  contactId?: string;
  conversationId?: string;
  whatsappAccountId?: unknown;
  userId?: string;
}): Promise<TwentyFourHourCheckResult> {
  const phone = normalizePhone(to || contactId || conversationId);
  const filter = buildIncomingFilter({ phone, contactId: String(contactId || '').trim(), conversationId: String(conversationId || '').trim() });

  if (!filter) {
    logger.warn('[whatsapp-24h-guard] Skipped enforcement: unable to resolve conversation identity', { messageType, to, contactId, conversationId });
    return { allowed: true, isInsideWindow: true, lastUserMessageAt: null };
  }

  const scopedFilter = { ...filter, ...(whatsappAccountId ? { whatsappAccountId, userId } : { userId }) };

  const lastIncomingMessage: any = await Message.findOne(scopedFilter).sort({ timestamp: -1, time: -1, createdAt: -1 }).lean();
  const lastUserMessageAtRaw = lastIncomingMessage?.timestamp || lastIncomingMessage?.time || lastIncomingMessage?.createdAt || null;
  const lastUserMessageAt = lastUserMessageAtRaw ? new Date(lastUserMessageAtRaw) : null;
  const now = Date.now();
  const isInsideWindow = Boolean(lastUserMessageAt) && !Number.isNaN(lastUserMessageAt!.getTime()) && now - lastUserMessageAt!.getTime() <= WINDOW_MS;

  if (!isInsideWindow && messageType !== 'template') {
    logger.warn('[whatsapp-24h-guard] Blocked outbound message outside 24h window', { messageType, to, contactId, conversationId, lastUserMessageAt });
    return { allowed: false, isInsideWindow, lastUserMessageAt };
  }

  return { allowed: true, isInsideWindow, lastUserMessageAt };
}
