// WhatsApp Coexistence (WhatsApp Business app + Cloud API on one number).
//
// Port of backend/src/services/coexistenceService.js — see that file and
// docs/meta-tech-provider/COEXISTENCE.md for the full explanation of the three
// coexistence webhook fields (`history`, `smb_message_echoes`,
// `smb_app_state_sync`) and why each is handled the way it is.
//
// One deliberate deviation, matching the rest of this app's webhook port: the
// caller awaits every step before responding, because a Vercel function offers
// no guarantee that work continues after the response is sent.

import WhatsAppAccount from '../models/WhatsAppAccount';
import Contact from '../models/Contact';
import Message from '../models/Message';
import { getGraphApiVersion } from '../config/graphApi';
import { loadWhatsAppAccountFromWebhookIdentifiers } from '../services/whatsappAccountService';
import { uploadWhatsAppMediaToCloudinary } from '../services/whatsappMediaService';
import { parseIncoming, forwardToWebhookDestinations } from './webhookProcessing';
import { saveAndEmitMessage } from './dispatch';
import { emitHistorySyncProgress } from '../socket/emitter';
import logger from '../utils/logger';

export const COEXISTENCE_FIELDS = ['history', 'smb_message_echoes', 'smb_app_state_sync'];

const normalizePhone = (v: unknown) => String(v || '').replace(/\D/g, '');

const toDate = (timestamp: unknown) => {
  const seconds = Number(timestamp);
  if (Number.isFinite(seconds) && seconds > 0) return new Date(seconds * 1000);
  return new Date();
};

type Identifiers = {
  phoneNumberId: string;
  displayPhoneNumber: string;
  wabaId: string;
  businessAccountId: string;
};

const identifiersFrom = (entry: any, value: any): Identifiers => {
  const metadata = value?.metadata || {};
  return {
    phoneNumberId: String(metadata.phone_number_id || ''),
    displayPhoneNumber: String(metadata.display_phone_number || ''),
    wabaId: String(metadata.waba_id || entry?.id || ''),
    businessAccountId: String(value?.business_account_id || ''),
  };
};

export type CoexistenceEvents = {
  echoes: Array<Identifiers & { message: any }>;
  historyChunks: Array<Identifiers & { metadata: any; threads: any[] }>;
  stateSyncs: Array<Identifiers & { item: any }>;
};

/** Pure, defensive extraction of coexistence events from a raw webhook body. */
export const extractCoexistenceEvents = (entries: any): CoexistenceEvents => {
  const echoes: CoexistenceEvents['echoes'] = [];
  const historyChunks: CoexistenceEvents['historyChunks'] = [];
  const stateSyncs: CoexistenceEvents['stateSyncs'] = [];

  for (const entry of Array.isArray(entries) ? entries : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const field = String(change?.field || '');
      if (!COEXISTENCE_FIELDS.includes(field)) continue;

      const value = change?.value || {};
      const ids = identifiersFrom(entry, value);

      if (field === 'smb_message_echoes') {
        for (const msg of Array.isArray(value?.message_echoes) ? value.message_echoes : []) {
          echoes.push({ ...ids, message: msg });
        }
        continue;
      }

      if (field === 'history') {
        for (const chunk of Array.isArray(value?.history) ? value.history : []) {
          historyChunks.push({
            ...ids,
            metadata: chunk?.metadata || {},
            threads: Array.isArray(chunk?.threads) ? chunk.threads : [],
          });
        }
        continue;
      }

      for (const item of Array.isArray(value?.state_sync) ? value.state_sync : []) {
        stateSyncs.push({ ...ids, item });
      }
    }
  }

  return { echoes, historyChunks, stateSyncs };
};

/**
 * The whole webhook context, not just the account row.
 *
 * This used to return `context.account` and drop the rest, which threw away
 * the decrypted `accessToken` — the one thing needed to fetch media from the
 * Graph API. Media sent from the WhatsApp Business app therefore had no way to
 * be resolved here, however much the rest of the pipeline wanted it.
 */
const resolveAccountContext = async (ids: Identifiers) => {
  try {
    const context: any = await loadWhatsAppAccountFromWebhookIdentifiers(
      {
        phoneNumberId: ids.phoneNumberId,
        wabaId: ids.wabaId,
        businessAccountId: ids.businessAccountId,
        displayPhoneNumber: ids.displayPhoneNumber,
      },
      { requireAccount: false }
    );
    return context || null;
  } catch (_error) {
    return null;
  }
};

/**
 * Mirrors an echoed media file to Cloudinary and records the URL on the saved
 * message.
 *
 * An echo carries a media id, never the file: the picture lives behind the
 * Graph API and needs the account's token to fetch. The inbound path already
 * does this (see webhookHandler), so a photo a customer sends renders
 * everywhere. A photo the business sends from the WhatsApp Business app or
 * WhatsApp Web took the echo path instead, which stored the id and stopped —
 * leaving `mediaUrl` empty forever. Every consumer then had nothing to render:
 * the shared inbox and the /api/v1/messages API both fall back to the message
 * body, which for an uncaptioned image is the raw media id (see parseIncoming).
 *
 * Best-effort, like the inbound path: the row is already saved and on screen,
 * so a media failure must never turn a delivered message into a lost one.
 */
const mirrorEchoMedia = async ({
  messageDocId,
  mediaId,
  accessToken,
}: {
  messageDocId: unknown;
  mediaId: string;
  accessToken: string;
}) => {
  try {
    const uploaded = await uploadWhatsAppMediaToCloudinary({
      mediaId,
      accessToken,
      graphVersion: getGraphApiVersion(),
    });
    await Message.findByIdAndUpdate(messageDocId, {
      $set: {
        mediaUrl: uploaded.mediaUrl,
        mimeType: uploaded.mimeType,
        mediaPublicId: uploaded.mediaPublicId,
        mediaResourceType: uploaded.mediaResourceType,
      },
    });
  } catch (error: any) {
    logger.error('[coexistence] echo media mirroring failed:', error.message);
  }
};

// Business-initiated traffic never opens Meta's 24-hour customer service
// window, so `conversation.windowOpen` is deliberately left alone here.
const touchContact = async ({
  phone,
  account,
  lastMessage,
  at,
  name = '',
}: {
  phone: string;
  account: any;
  lastMessage?: string;
  at: Date;
  name?: string;
}) => {
  if (!phone) return;

  const set: Record<string, unknown> = {
    ...(lastMessage ? { lastMessage, lastSeen: at } : {}),
    ...(name ? { name } : {}),
  };

  try {
    await Contact.findOneAndUpdate(
      { phone, ...(account?.userId ? { userId: account.userId } : {}) },
      {
        $setOnInsert: {
          phone,
          userId: account?.userId || null,
          whatsappAccountId: account?._id || null,
        },
        // Only include $set when there is something to set — a history thread
        // contributes nothing but the contact's existence, and Mongo rejects
        // an empty $set outright.
        ...(Object.keys(set).length ? { $set: set } : {}),
      },
      { upsert: true }
    );
  } catch (error: any) {
    logger.error('[coexistence] contact upsert failed:', error.message);
  }
};

const saveCoexistenceMessage = async ({
  account,
  accessToken = '',
  ids,
  msg,
  direction,
  source,
  isHistorical,
}: {
  account: any;
  accessToken?: string;
  ids: Identifiers;
  msg: any;
  direction: 'incoming' | 'outgoing';
  source: string;
  isHistorical: boolean;
}) => {
  const parsed: any = parseIncoming(msg);
  if (!parsed) return { saved: false as const, isDuplicate: false };

  const at = toDate(msg?.timestamp);
  const businessPhone = ids.displayPhoneNumber || ids.phoneNumberId;
  const outgoing = direction === 'outgoing';

  // saveAndEmitMessage de-duplicates on messageId, so an echo of a message this
  // platform itself sent (same wamid) is a no-op and re-delivered history
  // chunks are idempotent.
  const { message: savedMessage, isDuplicate } = await saveAndEmitMessage({
    userId: account?.userId,
    whatsappAccountId: account?._id,
    fromMe: outgoing,
    from: String(msg?.from || (outgoing ? businessPhone : '')),
    to: String(msg?.to || (outgoing ? '' : businessPhone)),
    message: parsed.message,
    body: parsed.message,
    text: parsed.type === 'text' ? parsed.message : '',
    timestamp: at,
    time: at,
    status: outgoing ? 'sent' : 'received',
    direction,
    messageId: String(msg?.id || ''),
    type: parsed.type,
    mediaId: parsed.mediaId,
    interactiveId: parsed.interactiveId || '',
    source,
    isHistorical,
  });

  // Live echoes only. A history backfill is already-delivered chat from up to
  // 180 days back: Meta has long since expired those media ids, and fetching
  // one per message would turn a bulk import into thousands of Graph calls —
  // which is why history has always skipped media downloads.
  if (!isDuplicate && !isHistorical && parsed.mediaId && accessToken) {
    await mirrorEchoMedia({
      messageDocId: (savedMessage as any)?._id,
      mediaId: parsed.mediaId,
      accessToken,
    });
  }

  return { saved: true as const, isDuplicate, parsed, at };
};

/**
 * `smb_message_echoes` — the customer replied from the WhatsApp Business app.
 * Stored as an outgoing message so the shared inbox stays accurate. Auto Reply
 * and Workflows are deliberately not run: this came from the business.
 */
export const processEchoes = async (echoes: CoexistenceEvents['echoes']) => {
  for (const echo of echoes) {
    try {
      const context = await resolveAccountContext(echo);
      const account = context?.account || null;
      const result = await saveCoexistenceMessage({
        account,
        accessToken: context?.accessToken || '',
        ids: echo,
        msg: echo.message,
        direction: 'outgoing',
        source: 'coexistence_app',
        isHistorical: false,
      });
      if (!result.saved || result.isDuplicate) continue;

      await touchContact({
        phone: normalizePhone(echo.message?.to),
        account,
        lastMessage: result.parsed.message,
        at: result.at,
      });

      if (account?._id) {
        await WhatsAppAccount.updateOne(
          { _id: account._id },
          {
            $set: {
              'coexistence.enabled': true,
              'coexistence.lastEchoAt': new Date(),
              lastWebhookAt: new Date(),
            },
          }
        );

        // Lets a sibling bot see that a human already answered from the
        // WhatsApp Business app and stand down. Awaited here rather than
        // fire-and-forget (as the Express version does): a Vercel function
        // offers no guarantee that work continues after the response is sent.
        try {
          await forwardToWebhookDestinations(account._id, {
            event: 'message.echo',
            source: 'coexistence_app',
            phoneNumberId: echo.phoneNumberId,
            from: String(echo.message?.from || ''),
            to: String(echo.message?.to || ''),
            messageId: String(echo.message?.id || ''),
            type: result.parsed.type,
            message: result.parsed.message,
            timestamp: result.at,
          });
        } catch (error: any) {
          logger.error('[coexistence] echo forward failed:', error.message);
        }
      }
    } catch (error: any) {
      logger.error('[coexistence] echo processing failed:', error.message);
    }
  }
};

/**
 * `history` — chunked backfill of the customer's pre-existing chats. Stored
 * with `isHistorical: true`; never triggers replies, routing, or media
 * downloads, since it is already-delivered history rather than live traffic.
 */
export const processHistoryChunks = async (chunks: CoexistenceEvents['historyChunks']) => {
  for (const chunk of chunks) {
    try {
      const account = (await resolveAccountContext(chunk))?.account || null;
      const businessPhone = normalizePhone(chunk.displayPhoneNumber || chunk.phoneNumberId);
      let imported = 0;

      for (const thread of chunk.threads) {
        const threadPhone = normalizePhone(thread?.id);
        for (const msg of Array.isArray(thread?.messages) ? thread.messages : []) {
          const fromPhone = normalizePhone(msg?.from);
          const direction = fromPhone && fromPhone === businessPhone ? 'outgoing' : 'incoming';
          const result = await saveCoexistenceMessage({
            account,
            ids: chunk,
            msg,
            direction,
            source: 'coexistence_history',
            isHistorical: true,
          });
          if (result.saved && !result.isDuplicate) imported += 1;
        }

        if (threadPhone) await touchContact({ phone: threadPhone, account, at: new Date() });
      }

      const progress = Number(chunk.metadata?.progress);
      const hasProgress = Number.isFinite(progress);
      const completed = hasProgress && progress >= 100;

      if (account?._id) {
        await WhatsAppAccount.updateOne(
          { _id: account._id },
          {
            $set: {
              'coexistence.enabled': true,
              'coexistence.historySyncStatus': completed ? 'completed' : 'in_progress',
              ...(hasProgress ? { 'coexistence.historySyncProgress': progress } : {}),
              'coexistence.lastHistorySyncAt': new Date(),
              lastWebhookAt: new Date(),
            },
            $inc: {
              'coexistence.historyChunksReceived': 1,
              'coexistence.historyMessagesImported': imported,
            },
          }
        );
      }

      // One event per chunk, not one per message: the individual saves above
      // deliberately do not emit (see saveAndEmitMessage), so this is the only
      // thing telling an open inbox that a backfill is running.
      if (account?.userId || account?._id) {
        emitHistorySyncProgress({
          userId: account?.userId,
          whatsappAccountId: account?._id,
          status: completed ? 'completed' : 'in_progress',
          progress: hasProgress ? progress : null,
          phase: chunk.metadata?.phase ?? null,
          chunkOrder: chunk.metadata?.chunk_order ?? null,
          messagesImported: imported,
        });
      }

      logger.info(
        `[coexistence] history chunk phase=${chunk.metadata?.phase ?? '?'} order=${chunk.metadata?.chunk_order ?? '?'} progress=${hasProgress ? progress : '?'} imported=${imported}`
      );
    } catch (error: any) {
      logger.error('[coexistence] history processing failed:', error.message);
    }
  }
};

/**
 * `smb_app_state_sync` — the WhatsApp Business app address book. A removal is
 * recorded but never deletes the CRM contact: dropping someone from a phone's
 * address book must not destroy that conversation's history or audit trail.
 */
export const processStateSyncs = async (stateSyncs: CoexistenceEvents['stateSyncs']) => {
  for (const sync of stateSyncs) {
    try {
      const item = sync.item || {};
      if (String(item.type || 'contact') !== 'contact') continue;

      const contact = item.contact || {};
      const phone = normalizePhone(contact.phone_number || contact.phone || contact.wa_id);
      if (!phone) continue;

      const account = (await resolveAccountContext(sync))?.account || null;
      const action = String(item.action || 'add').toLowerCase();
      const name = String(contact.full_name || contact.first_name || '').trim();

      if (action === 'remove' || action === 'delete') {
        await Contact.updateOne(
          { phone, ...(account?.userId ? { userId: account.userId } : {}) },
          { $set: { 'customFields.coexistenceRemovedAt': new Date() } }
        );
      } else {
        await touchContact({ phone, account, at: new Date(), name });
      }

      if (account?._id) {
        await WhatsAppAccount.updateOne(
          { _id: account._id },
          {
            $set: {
              'coexistence.enabled': true,
              'coexistence.lastStateSyncAt': new Date(),
              lastWebhookAt: new Date(),
            },
            $inc: { 'coexistence.contactsSynced': 1 },
          }
        );
      }
    } catch (error: any) {
      logger.error('[coexistence] state sync processing failed:', error.message);
    }
  }
};

export const processCoexistenceEvents = async (events: CoexistenceEvents) => {
  // History first so backfilled messages land before live echoes and inbound
  // messages, keeping conversations in chronological order.
  if (events.historyChunks.length) await processHistoryChunks(events.historyChunks);
  if (events.stateSyncs.length) await processStateSyncs(events.stateSyncs);
  if (events.echoes.length) await processEchoes(events.echoes);
};
