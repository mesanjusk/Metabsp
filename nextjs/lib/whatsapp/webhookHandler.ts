import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '../db/mongo';
import logger from '../utils/logger';
import { getWebhookVerifyToken, getGraphApiVersion } from '../config/graphApi';
import WhatsAppAccount from '../models/WhatsAppAccount';
import Message from '../models/Message';
import Contact from '../models/Contact';
import CampaignMessageStatus from '../models/CampaignMessageStatus';
import {
  loadWhatsAppAccountFromWebhookIdentifiers,
  loadWhatsAppAccountByPhoneNumberId,
} from '../services/whatsappAccountService';
import { uploadWhatsAppMediaToCloudinary } from '../services/whatsappMediaService';
import { resolveAutoReplyAction, resolveReplyDelayMs } from '../services/autoReplyService';
import { resolveMatchingWorkflow } from '../services/workflowService';
import { saveAndEmitMessage, normalizePhone } from './dispatch';
import { parseIncoming, deliverToDestinations, resolveInboundRouting } from './webhookProcessing';
import { extractCoexistenceEvents, processCoexistenceEvents } from './coexistence';
import { enqueueDelayedReply } from '../queues/whatsappSendQueue';
import { enqueueWebhookEnvelope } from '../queues/webhookQueue';

const RESOLVED_API_VERSION = getGraphApiVersion();

/**
 * GET /webhook, GET /api/whatsapp/webhook — Meta's verification handshake.
 * Ported unchanged in behavior from backend/src/controllers/whatsappController.js's
 * verifyWebhook. Stateless, fully portable.
 */
export async function handleVerifyWebhook(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge') || '';
  const verifyToken = getWebhookVerifyToken();

  if (!verifyToken) {
    logger.error('[WhatsApp] WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured — rejecting verification');
    return new NextResponse(null, { status: 403 });
  }
  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse(null, { status: 403 });
}

/**
 * POST /webhook, POST /api/whatsapp/webhook — Meta's inbound event delivery.
 *
 * This handler does exactly two things: verify Meta's HMAC signature, and
 * hand the payload to a durable queue. It then returns 200 without waiting
 * for any of the work.
 *
 * That split is not an optimisation, it is a requirement of being a BSP.
 * Meta expects a webhook to acknowledge within seconds and retries — then
 * eventually disables the subscription — for an endpoint that is slow or
 * failing. Real processing here means a media download from Meta, a
 * re-upload to Cloudinary, a fan-out to every registered customer
 * destination with retries, and workflow matching: comfortably tens of
 * seconds under load, and unbounded when a customer's own destination is
 * slow. Doing that before the ack put the whole platform's inbound delivery
 * at the mercy of the slowest downstream endpoint.
 *
 * Two earlier designs both failed for the same underlying reason. The Express
 * original did the work in a bare `setImmediate()` after responding — safe
 * only while that process happened to stay up, with no retry if it did not.
 * The first Next.js port awaited everything before responding, which was
 * correct for a serverless function that may be frozen after the response but
 * is what created the timeout exposure described above. A queue gives both
 * halves: an immediate ack, and processing that survives a restart because it
 * is persisted in Redis before the ack is sent.
 *
 * If enqueueing itself fails (Redis unavailable), the payload is processed
 * inline rather than dropped — a slow ack is recoverable, a lost customer
 * message is not.
 */
export async function handleReceiveWebhook(req: NextRequest): Promise<NextResponse> {
  // Raw body text is required for HMAC verification — must read it before
  // any JSON parsing, and only parse JSON after signature verification
  // passes (or is disabled).
  const rawBody = await req.text();

  try {
    const enforceSignature = String(process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE).toLowerCase() !== 'false';
    const appSecret = String(process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET || '');

    if (enforceSignature) {
      if (!appSecret) {
        logger.error('[WhatsApp] META_APP_SECRET not configured — rejecting webhook');
        return new NextResponse('Webhook signature verification not configured', { status: 403 });
      }
      const signature = req.headers.get('x-hub-signature-256') || '';
      if (!signature.startsWith('sha256=') || !rawBody) {
        return new NextResponse('Invalid signature', { status: 403 });
      }

      const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      const isValid = (() => {
        try {
          return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        } catch (_error) {
          return false;
        }
      })();

      if (!isValid) return new NextResponse('Invalid signature', { status: 403 });
    }

    const body = rawBody ? JSON.parse(rawBody) : {};

    const payloadObject = String(body?.object || '');
    if (payloadObject && payloadObject !== 'whatsapp_business_account') {
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    try {
      await enqueueWebhookEnvelope(body);
      return NextResponse.json({ received: true, queued: true }, { status: 200 });
    } catch (queueError: any) {
      logger.error(
        '[whatsapp] webhook enqueue failed, processing inline instead:',
        queueError.message
      );
      await processWebhookEnvelope(body);
      return NextResponse.json({ received: true, queued: false }, { status: 200 });
    }
  } catch (error: any) {
    logger.error('[whatsapp] webhook error:', error);
    // Ack 200 even on an unexpected error so Meta does not retry-storm a
    // payload that will fail identically — the error is logged above for
    // investigation. A 5xx here is what eventually gets a webhook disabled.
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

/**
 * Everything the webhook actually does, run by the queue worker
 * (lib/queues/webhookWorker.ts) rather than in the request that delivered it.
 * Exported so the worker — and the inline fallback above — share one
 * implementation.
 */
export async function processWebhookEnvelope(body: any): Promise<void> {
  await connectDB();

  try {
    const entries = Array.isArray(body?.entry) ? body.entry : [];
    const incoming: any[] = [];
    const statuses: any[] = [];

    // Coexistence-only fields (`history`, `smb_message_echoes`,
    // `smb_app_state_sync`). Empty for every Cloud-API-only account, which
    // never receives these changes.
    const coexistence = extractCoexistenceEvents(entries);
    await processCoexistenceEvents(coexistence);

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value || {};
        const metadata = value?.metadata || {};
        const phoneNumberId = String(metadata.phone_number_id || '');
        const wabaId = String(
          value?.messaging_product === 'whatsapp' ? value?.metadata?.waba_id || entry?.id || '' : entry?.id || ''
        );
        const businessAccountId = String(value?.business_account_id || '');

        if (Array.isArray(value?.statuses)) {
          for (const status of value.statuses) {
            statuses.push({ ...status, phoneNumberId, wabaId, businessAccountId });
          }
        }

        for (const msg of Array.isArray(value?.messages) ? value.messages : []) {
          const parsed = parseIncoming(msg);
          if (!parsed) continue;

          incoming.push({
            phoneNumberId,
            fromMe: false,
            from: String(msg.from || ''),
            to: String(metadata?.display_phone_number || metadata?.phone_number_id || ''),
            message: parsed.message,
            body: parsed.message,
            text: parsed.type === 'text' ? parsed.message : '',
            timestamp: new Date(Number(msg.timestamp || Date.now() / 1000) * 1000),
            time: new Date(Number(msg.timestamp || Date.now() / 1000) * 1000),
            status: 'received',
            direction: 'incoming',
            messageId: String(msg.id || ''),
            type: parsed.type,
            mediaId: (parsed as any).mediaId,
            interactiveId: (parsed as any).interactiveId || '',
            wabaId,
            businessAccountId,
          });
        }
      }
    }

    // ── Status events ────────────────────────────────────────────────────
    for (const statusEvent of statuses) {
      const messageId = String(statusEvent?.id || '');
      const status = String(statusEvent?.status || '').toLowerCase();
      const phoneNumberId = String(statusEvent?.phoneNumberId || '');
      if (!messageId || !['sent', 'delivered', 'read', 'failed'].includes(status)) continue;

      if (status === 'failed') {
        logger.error(
          '[WhatsApp][webhook] Delivery FAILED for message',
          messageId,
          'to',
          statusEvent?.recipient_id,
          'errors:',
          JSON.stringify(statusEvent?.errors || [])
        );
      } else {
        logger.info(`[WhatsApp][webhook] Message ${messageId} status -> ${status}`);
      }

      const matchedAccountContext = await loadWhatsAppAccountFromWebhookIdentifiers(
        { phoneNumberId, wabaId: statusEvent?.wabaId, businessAccountId: statusEvent?.businessAccountId },
        { requireAccount: false }
      );
      const matchedAccount: any = (matchedAccountContext as any)?.account || null;
      const timestamp = new Date(Number(statusEvent?.timestamp || Date.now() / 1000) * 1000);
      const campaignId = String(statusEvent?.conversation?.id || '');

      await CampaignMessageStatus.updateOne(
        { userId: matchedAccount?.userId, whatsappAccountId: matchedAccount?._id, messageId, status },
        {
          $setOnInsert: {
            userId: matchedAccount?.userId,
            whatsappAccountId: matchedAccount?._id,
            messageId,
            status,
            timestamp,
            campaignId,
          },
        },
        { upsert: true }
      );

      await Message.updateOne(
        { messageId, ...(matchedAccount?._id ? { whatsappAccountId: matchedAccount._id } : {}) },
        { $set: { status, timestamp, time: timestamp } }
      );
    }

    // ── Incoming messages ────────────────────────────────────────────────
    for (const payload of incoming) {
      const matchedAccountContext = await loadWhatsAppAccountFromWebhookIdentifiers(
        {
          phoneNumberId: payload.phoneNumberId,
          wabaId: payload.wabaId,
          businessAccountId: payload.businessAccountId,
          displayPhoneNumber: payload.to,
        },
        { requireAccount: false }
      );
      const matchedAccount: any = (matchedAccountContext as any)?.account || null;

      const withOwnership = { ...payload, userId: matchedAccount?.userId, whatsappAccountId: matchedAccount?._id };
      const { message, isDuplicate } = await saveAndEmitMessage(withOwnership);

      const phone = normalizePhone(payload.from);
      if (phone) {
        try {
          await Contact.findOneAndUpdate(
            { phone },
            {
              $setOnInsert: { phone, name: '', userId: matchedAccount?.userId || null, whatsappAccountId: matchedAccount?._id || null },
              $set: {
                lastMessage: payload.message,
                lastSeen: payload.timestamp,
                'conversation.lastCustomerMessageAt': payload.timestamp,
                'conversation.windowOpen': true,
              },
            },
            { upsert: true }
          );
        } catch (contactErr: any) {
          logger.error('[whatsapp] contact upsert failed:', contactErr.message);
        }
      }

      // Media download + Cloudinary re-upload — awaited here (unlike the
      // original's fire-and-forget `.then()`), since nothing would
      // guarantee it completes otherwise. This is the single biggest
      // execution-time contributor per message; see the maxDuration
      // export below and docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md §1.2.
      if (!isDuplicate && payload.mediaId && matchedAccount?.accessTokenEncrypted) {
        try {
          const accountContext: any = await loadWhatsAppAccountByPhoneNumberId(payload.phoneNumberId, { requireAccount: false });
          if (accountContext?.accessToken) {
            const uploaded = await uploadWhatsAppMediaToCloudinary({
              mediaId: payload.mediaId,
              accessToken: accountContext.accessToken,
              graphVersion: RESOLVED_API_VERSION,
            });
            await Message.findByIdAndUpdate((message as any)._id, { $set: { mediaUrl: uploaded.mediaUrl, mimeType: uploaded.mimeType } });
          }
        } catch (error: any) {
          logger.error('[whatsapp] media processing failed', error.message);
        }
      }

      let routingTargets: any[] = [];
      if (!isDuplicate && matchedAccount?._id) {
        try {
          routingTargets = await resolveInboundRouting(matchedAccount._id, payload);
        } catch (routingErr: any) {
          logger.error('[whatsapp] inbound routing failed:', routingErr.message);
        }
      }

      if (!isDuplicate && payload.type === 'text' && matchedAccount?._id && matchedAccount?.userId) {
        const contactDoc = phone ? await Contact.findOne({ phone }) : null;

        const matchedWorkflow = await resolveMatchingWorkflow(payload.message, {
          userId: matchedAccount.userId,
          whatsappAccountId: matchedAccount._id,
        });

        if (matchedWorkflow) {
          // Ported from runWorkflowSteps — each step becomes one delayed
          // BullMQ job at its cumulative offset instead of a setTimeout
          // chain (see enqueueDelayedReply's doc comment for why).
          let cumulativeDelayMs = 0;
          for (const step of matchedWorkflow.steps) {
            cumulativeDelayMs += Math.max(0, Number(step.delaySeconds) || 0) * 1000;
            await enqueueDelayedReply(
              {
                accountId: String(matchedAccount._id),
                userId: String(matchedAccount.userId),
                to: payload.from,
                messageType: step.replyType === 'template' ? 'template' : 'text',
                body: step.reply,
                templateName: step.reply,
                language: step.templateLanguage || 'en_US',
              },
              cumulativeDelayMs
            ).catch((err: any) => logger.error('[whatsapp] workflow step enqueue failed:', err.message));
          }
        }

        const matchedRule = matchedWorkflow
          ? null
          : await resolveAutoReplyAction({
              incomingText: payload.message,
              filters: { userId: matchedAccount.userId, whatsappAccountId: matchedAccount._id },
              contactDoc,
            });

        if (matchedRule) {
          const delay = resolveReplyDelayMs(matchedRule);
          await enqueueDelayedReply(
            {
              accountId: String(matchedAccount._id),
              userId: String(matchedAccount.userId),
              to: payload.from,
              messageType: matchedRule.replyType === 'template' ? 'template' : 'text',
              body: matchedRule.reply,
              templateName: matchedRule.reply,
              language: matchedRule.templateLanguage || 'en_US',
            },
            delay
          ).catch((err: any) => logger.error('[whatsapp] auto-reply enqueue failed:', err.message));
        }
      }

      if (!isDuplicate && routingTargets.length) {
        // Awaited (unlike the original's fire-and-forget) — see the class
        // doc comment above. Runs in parallel across destinations via
        // Promise.allSettled inside deliverToDestinations, so worst case is
        // bounded by one destination's retry chain (~20s), not N of them.
        await deliverToDestinations(routingTargets, payload).catch((err: any) =>
          logger.error('[whatsapp] webhook destination forward failed:', err.message)
        );
      }

      if (matchedAccount?._id) {
        await WhatsAppAccount.updateOne(
          { _id: matchedAccount._id },
          { $set: { lastWebhookAt: new Date(), lastSyncAt: new Date(), webhookSubscribed: true, status: 'active' } }
        );
      }
    }

  } catch (error: any) {
    // Rethrown, unlike the pre-queue version which swallowed this: the caller
    // is now a BullMQ job, and a thrown error is what earns the payload its
    // retries with backoff instead of being lost. Meta has already been
    // acked, so nothing here can cause a webhook retry-storm.
    logger.error('[whatsapp] webhook processing error:', error);
    throw error;
  }
}
