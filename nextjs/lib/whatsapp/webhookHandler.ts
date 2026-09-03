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
} from '../services/whatsappAccountService';
import { uploadWhatsAppMediaToCloudinary } from '../services/whatsappMediaService';
import { resolveAutoReplyAction, resolveReplyDelayMs } from '../services/autoReplyService';
import { resolveMatchingWorkflow } from '../services/workflowService';
import { saveAndEmitMessage, normalizePhone } from './dispatch';
import { parseIncoming, deliverToDestinations, resolveInboundRouting } from './webhookProcessing';
import { extractCoexistenceEvents, processCoexistenceEvents } from './coexistence';
import { enqueueDelayedReply } from '../queues/whatsappSendQueue';
import { enqueueWebhookEnvelope } from '../queues/webhookQueue';
import { recordWebhookOutcome } from './webhookTelemetry';

const RESOLVED_API_VERSION = getGraphApiVersion();

/**
 * How long the enqueue gets before the payload is processed inline instead.
 *
 * Not a performance tuning knob — it is what makes the inline fallback below
 * reachable at all. The shared Redis connection is created with
 * `maxRetriesPerRequest: null` and ioredis's offline queue on, so a command
 * issued while Redis is unreachable is buffered and retried indefinitely: it
 * does not reject, it never settles. `await enqueueWebhookEnvelope(...)`
 * therefore hung until the platform killed the request, Meta saw a timeout
 * rather than a 200, and — after enough of them — disabled the subscription.
 * The catch block was written for a Redis outage and was the one thing a
 * Redis outage could not trigger.
 *
 * Chosen well under Meta's own patience for an ack, so that losing Redis
 * costs a slow acknowledgement rather than a dropped message.
 */
const ENQUEUE_TIMEOUT_MS = Number(process.env.WEBHOOK_ENQUEUE_TIMEOUT_MS) || 2500;

class EnqueueTimeoutError extends Error {
  constructor(ms: number) {
    super(`Redis did not accept the webhook envelope within ${ms}ms`);
    this.name = 'EnqueueTimeoutError';
  }
}

async function enqueueWithinTimeout(body: any): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      enqueueWebhookEnvelope(body),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new EnqueueTimeoutError(ENQUEUE_TIMEOUT_MS)), ENQUEUE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
    void recordWebhookOutcome('verify_rejected');
    return new NextResponse(null, { status: 403 });
  }
  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('[WhatsApp] Webhook verification handshake accepted');
    void recordWebhookOutcome('verify_ok');
    return new NextResponse(challenge, { status: 200 });
  }

  // Logged because the dashboard reports this as a generic failure to
  // verify, which reads as "the URL is wrong" when the URL is fine and the
  // token is what differs.
  logger.warn(
    `[WhatsApp] Webhook verification rejected (mode=${mode || 'none'}, verify token ${token ? 'did not match' : 'absent'}) — ` +
      'the value in Meta App Dashboard → WhatsApp → Configuration must equal WHATSAPP_WEBHOOK_VERIFY_TOKEN on this deployment'
  );
  void recordWebhookOutcome('verify_rejected');
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
        void recordWebhookOutcome('rejected_unconfigured');
        return new NextResponse('Webhook signature verification not configured', { status: 403 });
      }
      const signature = req.headers.get('x-hub-signature-256') || '';
      if (!signature.startsWith('sha256=') || !rawBody) {
        // Every rejection is logged from here on. A refused delivery used to
        // be silent on both sides — Meta's dashboard still shows the
        // subscription as saved, and nothing here said otherwise — which
        // makes a wrong app secret indistinguishable from a Meta-side
        // misconfiguration for as long as nobody reads the response bodies
        // Meta keeps to itself.
        logger.error(
          `[WhatsApp] Webhook rejected: ${signature ? 'malformed' : 'missing'} X-Hub-Signature-256 header. ` +
            'Meta always signs deliveries, so this is usually another caller — or a proxy stripping the header'
        );
        void recordWebhookOutcome('rejected_signature');
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

      if (!isValid) {
        logger.error(
          '[WhatsApp] Webhook rejected: X-Hub-Signature-256 does not match META_APP_SECRET. ' +
            'The signing secret is the App Secret of the SAME Meta app the callback URL is registered under — ' +
            'set WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE=false only to confirm that diagnosis, never as the fix'
        );
        void recordWebhookOutcome('rejected_signature');
        return new NextResponse('Invalid signature', { status: 403 });
      }
    }

    const body = rawBody ? JSON.parse(rawBody) : {};

    const payloadObject = String(body?.object || '');
    if (payloadObject && payloadObject !== 'whatsapp_business_account') {
      void recordWebhookOutcome('ignored_object');
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    void recordWebhookOutcome('accepted');

    try {
      await enqueueWithinTimeout(body);
      return NextResponse.json({ received: true, queued: true }, { status: 200 });
    } catch (queueError: any) {
      logger.error(
        '[whatsapp] webhook enqueue failed, processing inline instead:',
        queueError.message
      );
      // A timed-out enqueue may still land later, in which case the worker
      // processes an envelope this request has already handled. That is safe
      // and deliberate: saveAndEmitMessage de-duplicates on messageId before
      // any side effect, so the duplicate costs a database read rather than a
      // second auto-reply. Losing the message is the outcome worth avoiding.
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

    // One line per envelope, at info, so a working pipeline is visible in the
    // logs rather than only its failures. An envelope that reports 0 and 0 is
    // itself the answer to "Meta says it delivered, where did it go?" — it
    // carried a field this app does not consume.
    logger.info(
      `[whatsapp][webhook] Envelope processed: ${incoming.length} message(s), ${statuses.length} status update(s)`
    );

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

      if (!matchedAccount) {
        // The message is still saved — dropping a customer's words because
        // our own records are incomplete would be worse — but it is saved
        // with no owner, and every inbox query is scoped by userId or
        // whatsappAccountId. It will therefore never be shown to anyone.
        //
        // This is the failure mode that looks exactly like "the webhook is
        // not working": deliveries arrive, are acknowledged, are written to
        // the database, and the inbox stays empty. The cause is always the
        // same shape — the number sending us traffic is not the number this
        // deployment has connected (a WABA connected on another environment,
        // a phone number id that changed, or an account row left
        // 'disconnected').
        logger.error(
          '[whatsapp][webhook] Inbound message matched NO connected WhatsApp account and will not appear in any inbox — ' +
            `phone_number_id=${payload.phoneNumberId || 'none'} waba_id=${payload.wabaId || 'none'} ` +
            `display_phone_number=${payload.to || 'none'}. Connect that number, or check the account's status field.`
        );
      }

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
      // Keyed off the already-resolved context rather than re-reading the row
      // and re-checking accessTokenEncrypted: a legacy-env match has a usable
      // token and no encrypted field, so the old guard skipped media on
      // exactly the deployments the fallback above is for.
      if (!isDuplicate && payload.mediaId) {
        try {
          const accountContext: any = matchedAccountContext;
          if (accountContext?.accessToken) {
            const uploaded = await uploadWhatsAppMediaToCloudinary({
              mediaId: payload.mediaId,
              accessToken: accountContext.accessToken,
              graphVersion: RESOLVED_API_VERSION,
            });
            await Message.findByIdAndUpdate((message as any)._id, {
              $set: {
                mediaUrl: uploaded.mediaUrl,
                mimeType: uploaded.mimeType,
                mediaPublicId: uploaded.mediaPublicId,
                mediaResourceType: uploaded.mediaResourceType,
              },
            });
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
