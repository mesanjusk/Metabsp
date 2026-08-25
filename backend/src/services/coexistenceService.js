// WhatsApp Coexistence (WhatsApp Business app + Cloud API on one number).
//
// A number onboarded through Embedded Signup with
// `extras.featureType = 'whatsapp_business_app_onboarding'` stays live in the
// customer's WhatsApp Business app while this platform also sends and receives
// on it via Cloud API. Meta keeps the two sides in sync with three webhook
// fields that a Cloud-API-only integration never sees:
//
//   • `history`             — up to 6 months of the customer's existing chats,
//                             streamed in chunks shortly after onboarding.
//   • `smb_message_echoes`  — every message the customer subsequently sends
//                             from the WhatsApp Business app or a linked
//                             device, echoed back so the platform inbox does
//                             not silently fall out of date.
//   • `smb_app_state_sync`  — contacts added/changed/removed in the app.
//
// These arrive on the same `/webhook` endpoint as ordinary `messages` events,
// under `entry[].changes[].field`, and are ignored entirely unless handled
// here. See docs/meta-tech-provider/COEXISTENCE.md.
//
// Parsing (extractCoexistenceEvents) is deliberately separated from
// persistence (createCoexistenceProcessor) so the payload shapes can be tested
// without a database, and so unknown/renamed keys degrade into "no events"
// rather than throwing inside the webhook handler.

const WhatsAppAccount = require('../repositories/whatsappAccount');
const Contact = require('../repositories/contact');
const { loadWhatsAppAccountFromWebhookIdentifiers } = require('./whatsappAccountService');
const logger = require('../utils/logger');

const COEXISTENCE_FIELDS = ['history', 'smb_message_echoes', 'smb_app_state_sync'];

const normalizePhone = (v) => String(v || '').replace(/\D/g, '');

const toDate = (timestamp) => {
  const seconds = Number(timestamp);
  if (Number.isFinite(seconds) && seconds > 0) return new Date(seconds * 1000);
  return new Date();
};

// Shared identifiers every coexistence change carries, extracted the same way
// receiveWebhook does it for `messages`/`statuses`.
const identifiersFrom = (entry, value) => {
  const metadata = value?.metadata || {};
  return {
    phoneNumberId: String(metadata.phone_number_id || ''),
    displayPhoneNumber: String(metadata.display_phone_number || ''),
    wabaId: String(metadata.waba_id || entry?.id || ''),
    businessAccountId: String(value?.business_account_id || ''),
  };
};

/**
 * Pulls coexistence events out of a raw Meta webhook body.
 * Pure and defensive: any shape it does not recognise yields no events.
 *
 * @param {Array} entries `body.entry`
 * @returns {{echoes: Array, historyChunks: Array, stateSyncs: Array}}
 */
const extractCoexistenceEvents = (entries) => {
  const echoes = [];
  const historyChunks = [];
  const stateSyncs = [];

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

      // smb_app_state_sync
      for (const item of Array.isArray(value?.state_sync) ? value.state_sync : []) {
        stateSyncs.push({ ...ids, item });
      }
    }
  }

  return { echoes, historyChunks, stateSyncs };
};

/**
 * Builds the persistence half. `parseIncoming` and `saveAndEmitMessage` are
 * injected rather than required so this module stays free of a circular
 * dependency on the controller that owns them.
 */
const createCoexistenceProcessor = ({
  parseIncoming,
  saveAndEmitMessage,
  forwardToWebhookDestinations = null,
}) => {
  const resolveAccount = async (ids) => {
    try {
      const context = await loadWhatsAppAccountFromWebhookIdentifiers(
        {
          phoneNumberId: ids.phoneNumberId,
          wabaId: ids.wabaId,
          businessAccountId: ids.businessAccountId,
          displayPhoneNumber: ids.displayPhoneNumber,
        },
        { requireAccount: false }
      );
      return context?.account || null;
    } catch (_error) {
      return null;
    }
  };

  // An echo (or a historical outgoing message) is business-initiated, so it
  // must never flip `conversation.windowOpen` — only a customer message opens
  // Meta's 24-hour customer service window.
  const touchContact = async ({ phone, account, lastMessage, at, name = '' }) => {
    if (!phone) return;

    const set = {
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
          // Only include $set when there is something to set — a history
          // thread contributes nothing but the contact's existence, and Mongo
          // rejects an empty $set outright.
          ...(Object.keys(set).length ? { $set: set } : {}),
        },
        { upsert: true }
      );
    } catch (error) {
      logger.error('[coexistence] contact upsert failed:', error.message);
    }
  };

  const saveCoexistenceMessage = async ({ account, ids, msg, direction, source, isHistorical }) => {
    const parsed = parseIncoming(msg);
    if (!parsed) return { saved: false, isDuplicate: false };

    const at = toDate(msg?.timestamp);
    const businessPhone = ids.displayPhoneNumber || ids.phoneNumberId;
    const outgoing = direction === 'outgoing';

    // `saveAndEmitMessage` de-duplicates on messageId, so an echo of a message
    // this platform itself sent through Cloud API (same wamid) is a no-op, and
    // repeated history chunks are safely idempotent.
    const { isDuplicate } = await saveAndEmitMessage({
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
      isHistorical: Boolean(isHistorical),
    });

    return { saved: true, isDuplicate, parsed, at, outgoing };
  };

  /**
   * `smb_message_echoes` — the customer replied from the WhatsApp Business app.
   * Stored as an ordinary outgoing message so the shared inbox shows it, and
   * forwarded to webhook destinations so sibling bots can see that a human
   * already answered. Deliberately does NOT run Auto Reply / Workflows: the
   * message came from the business, not from a customer.
   */
  const processEchoes = async (echoes) => {
    for (const echo of echoes) {
      try {
        const account = await resolveAccount(echo);
        const result = await saveCoexistenceMessage({
          account,
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

          if (forwardToWebhookDestinations) {
            forwardToWebhookDestinations(account._id, {
              event: 'message.echo',
              source: 'coexistence_app',
              phoneNumberId: echo.phoneNumberId,
              from: String(echo.message?.from || ''),
              to: String(echo.message?.to || ''),
              messageId: String(echo.message?.id || ''),
              type: result.parsed.type,
              message: result.parsed.message,
              timestamp: result.at,
            }).catch((error) => logger.error('[coexistence] echo forward failed:', error.message));
          }
        }
      } catch (error) {
        logger.error('[coexistence] echo processing failed:', error.message);
      }
    }
  };

  /**
   * `history` — backfill of the customer's pre-existing WhatsApp Business app
   * chats, delivered in chunks with a 0-100 `progress`. Messages are stored
   * with `isHistorical: true` and never trigger replies, routing, or media
   * downloads: they are already-delivered history, not live traffic.
   */
  const processHistoryChunks = async (chunks) => {
    for (const chunk of chunks) {
      try {
        const account = await resolveAccount(chunk);
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

          if (threadPhone) {
            await touchContact({ phone: threadPhone, account, at: new Date() });
          }
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

        logger.info(
          `[coexistence] history chunk phase=${chunk.metadata?.phase ?? '?'} order=${chunk.metadata?.chunk_order ?? '?'} progress=${hasProgress ? progress : '?'} imported=${imported}`
        );
      } catch (error) {
        logger.error('[coexistence] history processing failed:', error.message);
      }
    }
  };

  /**
   * `smb_app_state_sync` — the customer's WhatsApp Business app address book.
   * A `remove`/`delete` action is recorded but never deletes the CRM contact:
   * removing someone from a phone's address book must not destroy that
   * conversation's history or its billing/audit trail here.
   */
  const processStateSyncs = async (stateSyncs) => {
    for (const sync of stateSyncs) {
      try {
        const item = sync.item || {};
        if (String(item.type || 'contact') !== 'contact') continue;

        const contact = item.contact || {};
        const phone = normalizePhone(contact.phone_number || contact.phone || contact.wa_id);
        if (!phone) continue;

        const account = await resolveAccount(sync);
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
      } catch (error) {
        logger.error('[coexistence] state sync processing failed:', error.message);
      }
    }
  };

  return { processEchoes, processHistoryChunks, processStateSyncs };
};

module.exports = {
  COEXISTENCE_FIELDS,
  extractCoexistenceEvents,
  createCoexistenceProcessor,
};
