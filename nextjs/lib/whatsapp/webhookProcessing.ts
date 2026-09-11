import axios from 'axios';
import crypto from 'crypto';
import WebhookDestination from '../models/WebhookDestination';
import ConversationOwner from '../models/ConversationOwner';
import WhatsAppAccount from '../models/WhatsAppAccount';
import logger from '../utils/logger';
import { normalizePhone } from './dispatch';
import { handleWhatsAppAttendanceMessage } from '../services/attendanceService';
import { enqueueDelayedReply } from '../queues/whatsappSendQueue';

// Ported from backend/src/controllers/whatsappController.js's webhook
// section (parseIncoming, postToWebhookDestination, forward/deliver,
// resolveInboundRouting) — see docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md §1.2
// for why these had to move off the fire-and-forget setImmediate() pattern
// the original used and be awaited synchronously here instead.

export const parseIncoming = (msg: any = {}) => {
  const type = String(msg.type || 'text').toLowerCase();
  if (type === 'text') return { type, message: String(msg.text?.body || ''), mediaId: '' };
  if (['image', 'video', 'audio', 'sticker', 'document'].includes(type)) {
    const mediaNode = msg[type] || {};
    return { type, message: String(mediaNode.caption || mediaNode.id || ''), mediaId: String(mediaNode.id || '') };
  }
  if (type === 'interactive') {
    const iType = msg.interactive?.type;
    let interactiveId = '';
    let text = '';
    if (iType === 'button_reply') {
      interactiveId = msg.interactive.button_reply?.id || '';
      text = msg.interactive.button_reply?.title || '';
    } else if (iType === 'list_reply') {
      interactiveId = msg.interactive.list_reply?.id || '';
      text = msg.interactive.list_reply?.title || '';
    } else {
      interactiveId = JSON.stringify(msg.interactive || {});
    }
    return { type, message: text || interactiveId, mediaId: '', interactiveId };
  }
  if (type === 'button') {
    const interactiveId = msg.button?.payload || '';
    return { type, message: msg.button?.text || interactiveId, mediaId: '', interactiveId };
  }
  return null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const WEBHOOK_FORWARD_RETRY_DELAYS_MS = [5000, 15000];

async function postToWebhookDestination(dest: any, payload: unknown, body: string, signature: string) {
  let lastError: any = null;
  for (let attempt = 0; attempt <= WEBHOOK_FORWARD_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await axios.post(dest.url, payload, {
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json',
          'X-Metabsp-Event': 'message.received',
          'X-Metabsp-Signature-256': signature,
        },
      });
      return { ok: true as const };
    } catch (err: any) {
      lastError = err;
      const delay = WEBHOOK_FORWARD_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      logger.warn(`[webhook-destinations] attempt ${attempt + 1} failed for ${dest.url} (${err.message}), retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
  return { ok: false as const, error: lastError };
}

export async function deliverToDestinations(destinations: any[], payload: unknown) {
  if (!destinations.length) return;

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    destinations.map(async (dest) => {
      const signature = 'sha256=' + crypto.createHmac('sha256', dest.secret).update(body).digest('hex');
      const result = await postToWebhookDestination(dest, payload, body, signature);

      if (result.ok) {
        await WebhookDestination.updateOne({ _id: dest._id }, { $set: { lastAttemptAt: new Date(), lastStatus: 'success', lastError: '' } });
      } else {
        logger.error('[webhook-destinations] forward failed after retries:', dest.url, result.error?.message);
        await WebhookDestination.updateOne(
          { _id: dest._id },
          { $set: { lastAttemptAt: new Date(), lastStatus: 'failed', lastError: result.error?.message || 'Unknown error' } }
        );
      }
    })
  );
}

const UNIVERSAL_EXIT_KEYWORD = 'EXIT';

const startsWithKeyword = (upperText: string, keyword: unknown) => {
  const kw = String(keyword || '').trim().toUpperCase();
  return Boolean(kw) && (upperText === kw || upperText.startsWith(`${kw} `));
};

// Fan-out to every active destination for this account. Used for events that
// cannot cause a reply loop — contact changes and coexistence message echoes —
// unlike inbound customer messages, which go through resolveInboundRouting's
// keyword routing instead. Mirrors forwardToWebhookDestinations in
// backend/src/controllers/whatsappController.js.
export async function forwardToWebhookDestinations(whatsappAccountId: unknown, payload: unknown) {
  const destinations: any[] = await WebhookDestination.find({ whatsappAccountId, isActive: true }).lean();
  return deliverToDestinations(destinations, payload);
}

export async function resolveInboundRouting(whatsappAccountId: unknown, payload: any) {
  // Attendance is checked before customer routing, workflows and auto-replies.
  // The handler itself verifies that the sender belongs to the existing
  // owner/team roster, so a customer who sends "IN" or "OUT" is untouched.
  if (payload?.type === 'text') {
    try {
      const account: any = await WhatsAppAccount.findById(whatsappAccountId).lean();
      if (account) {
        const attendance = await handleWhatsAppAttendanceMessage({ account, payload });
        if (attendance.handled) {
          // webhookHandler checks payload.type === 'text' before workflows and
          // auto-replies. Marking this in-memory payload as consumed prevents a
          // staff attendance command from also triggering customer automation.
          payload.type = 'attendance';
          if (attendance.reply) {
            await enqueueDelayedReply({
              accountId: String(account._id),
              userId: String(account.userId),
              to: payload.from,
              messageType: 'text',
              body: attendance.reply,
              templateName: '',
              language: 'en_US',
            }, 0).catch((err: any) => logger.error('[attendance] reply enqueue failed:', err.message));
          }
          return [];
        }
      }
    } catch (error: any) {
      // Attendance must never break the BSP inbound pipeline. Unexpected
      // attendance errors are logged and the message continues as a normal
      // customer/team message rather than being dropped.
      logger.error('[attendance] inbound command processing failed:', error.message);
    }
  }

  const phone = normalizePhone(payload.from);
  const text = payload.type === 'text' ? String(payload.message || '').trim() : '';
  const upperText = text.toUpperCase();

  const destinations: any[] = await WebhookDestination.find({ whatsappAccountId, isActive: true }).lean();
  if (!destinations.length) return [];

  const keywordDest = destinations.find((dest) =>
    [dest.entryKeyword, ...(dest.aliases || [])].some((kw) => startsWithKeyword(upperText, kw))
  );
  if (keywordDest) {
    await ConversationOwner.updateOne(
      { whatsappAccountId, phone },
      { $set: { destinationId: keywordDest._id, lastActivityAt: new Date() } },
      { upsert: true }
    );
    return [keywordDest];
  }

  const owner: any = phone ? await ConversationOwner.findOne({ whatsappAccountId, phone }).lean() : null;
  const ownerActive = Boolean(
    owner?.lastActivityAt && Date.now() - new Date(owner.lastActivityAt).getTime() < (ConversationOwner as any).TTL_MS
  );
  if (ownerActive) {
    if (upperText === UNIVERSAL_EXIT_KEYWORD) {
      await ConversationOwner.deleteOne({ _id: owner._id });
    } else {
      await ConversationOwner.updateOne({ _id: owner._id }, { $set: { lastActivityAt: new Date() } });
    }
    const ownedDest = destinations.find((dest) => String(dest._id) === String(owner.destinationId));
    return ownedDest ? [ownedDest] : [];
  }

  return destinations.filter((dest) => dest.fanoutFallback || !dest.entryKeyword);
}
