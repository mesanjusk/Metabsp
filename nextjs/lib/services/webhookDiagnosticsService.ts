// Why an inbound WhatsApp message is not in the inbox.
//
// preflightCheckService.ts answers a different question — is the Meta-side
// configuration correct — and answers it well. It cannot answer this one,
// because a perfectly configured subscription and a completely broken
// delivery path look identical from Meta's dashboard: a saved callback URL
// with the fields ticked.
//
// An inbound message crosses five stages, and each one fails silently:
//
//   1. Meta decides to deliver     — the app subscription must include
//                                    `messages`, and the WABA must have this
//                                    app in its subscribed_apps.
//   2. The request reaches us      — DNS, TLS and the deployment actually
//                                    serving the callback URL Meta holds.
//   3. We accept it                — the HMAC must match META_APP_SECRET.
//                                    The GET handshake that "verified" the
//                                    URL never touches the app secret, so a
//                                    wrong secret verifies fine and then
//                                    refuses every delivery.
//   4. It gets processed           — the queue needs a worker. Enqueued with
//                                    none running, the payload waits forever
//                                    while the endpoint answers a healthy 200.
//   5. It lands somewhere visible  — an inbound message whose number matches
//                                    no connected account is stored with no
//                                    userId, and every inbox query is scoped
//                                    by owner. Saved, acknowledged, invisible.
//
// This module reports on all five, from this deployment's own vantage point,
// so the answer is one call instead of five investigations. It is read-only:
// no Graph write, no queue mutation, and any stage that cannot be checked is
// reported as 'unknown' rather than throwing away the other four.

import mongoose from 'mongoose';
import Message from '../models/Message';
import WhatsAppAccount from '../models/WhatsAppAccount';
import { getWebhookVerifyToken, getGraphApiVersion } from '../config/graphApi';
import { fetchAppWebhookFields, checkWabaSubscriptions, BASE_WEBHOOK_FIELDS } from './preflightCheckService';
import { readWebhookTelemetry } from '../whatsapp/webhookTelemetry';
import { getWebhookQueue, WEBHOOK_QUEUE_NAME } from '../queues/webhookQueue';
import logger from '../utils/logger';

export type Severity = 'ok' | 'info' | 'warn' | 'error';

const severityRank: Record<Severity, number> = { ok: 0, info: 1, warn: 2, error: 3 };

const worstSeverity = (items: { severity: Severity }[]): Severity =>
  items.reduce<Severity>((worst, item) => (severityRank[item.severity] > severityRank[worst] ? item.severity : worst), 'ok');

// Long enough to cover "we changed the URL yesterday and nothing has come in
// since", short enough that last week's traffic cannot make today look healthy.
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

// The queue is only consulted for its depth; anything longer than this and the
// answer is "Redis is not reachable", which is itself the finding.
const QUEUE_TIMEOUT_MS = 3000;

function withTimeout<T>(work: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(onTimeout()), ms);
    const settle = (value: T) => {
      clearTimeout(timer);
      resolve(value);
    };
    work.then(settle, () => settle(onTimeout()));
  });
}

/**
 * Stage 3, local half: can this deployment accept a delivery at all.
 *
 * Both values are reported as present/absent only. The verify token is
 * already shown in full by the admin webhook-config panel (it has to be, to
 * be pasted into Meta), but the app secret is never echoed anywhere.
 */
export function checkEndpointConfig() {
  const verifyToken = getWebhookVerifyToken();
  const appSecret = String(process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET || '');
  const enforceSignature = String(process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE).toLowerCase() !== 'false';

  const problems: string[] = [];
  if (!verifyToken) problems.push('WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set — the URL cannot even be verified');
  if (enforceSignature && !appSecret) {
    problems.push('META_APP_SECRET is not set while signature enforcement is on — every delivery is refused with 403');
  }

  return {
    id: 'endpoint_config',
    severity: (problems.length ? 'error' : enforceSignature ? 'ok' : 'warn') as Severity,
    summary: problems.length
      ? problems.join('; ')
      : enforceSignature
        ? 'Verify token and app secret are configured, and signatures are enforced'
        : 'WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE=false — deliveries are accepted unsigned. Never leave this off in production.',
    hasVerifyToken: Boolean(verifyToken),
    hasAppSecret: Boolean(appSecret),
    enforceSignature,
    paths: ['/webhook', '/api/whatsapp/webhook'],
  };
}

/**
 * Stage 1: what Meta itself believes. The callback URL reported here is the
 * one Meta will actually call — comparing it against this deployment's own
 * origin is how a URL updated on the wrong app, or on the wrong environment,
 * becomes visible.
 */
export async function checkMetaSubscription({ expectedOrigin = '' }: { expectedOrigin?: string } = {}) {
  const graphVersion = getGraphApiVersion();
  const result = await fetchAppWebhookFields({ graphVersion });

  if (result.status !== 'ok') {
    return {
      id: 'meta_subscription',
      severity: (result.status === 'not_subscribed' ? 'error' : 'warn') as Severity,
      summary:
        result.status === 'not_subscribed'
          ? 'This Meta app has no whatsapp_business_account webhook subscription — nothing will ever be delivered'
          : `Could not read the subscription from Meta: ${result.reason}`,
      callbackUrl: '',
      fields: [],
      hasMessagesField: false,
      active: null,
    };
  }

  const fields: string[] = result.fields || [];
  const hasMessagesField = fields.includes('messages');
  const callbackUrl = String(result.callbackUrl || '');

  // Meta stores one callback URL per app. A URL that does not point at this
  // deployment is the whole diagnosis, and no amount of local health explains
  // it away.
  const pointsElsewhere = Boolean(
    expectedOrigin && callbackUrl && !callbackUrl.toLowerCase().startsWith(expectedOrigin.toLowerCase())
  );

  let severity: Severity = 'ok';
  let summary = `Meta will POST to ${callbackUrl || '(no URL reported)'} for: ${fields.join(', ') || 'no fields'}`;

  if (!hasMessagesField) {
    severity = 'error';
    summary =
      'The `messages` field is NOT subscribed. Every other field can be ticked and no customer message will ever ' +
      `arrive. Subscribe it in Meta App Dashboard → WhatsApp → Configuration → Webhook fields. Currently: ${fields.join(', ') || 'none'}`;
  } else if (pointsElsewhere) {
    severity = 'error';
    summary = `Meta delivers to ${callbackUrl}, which is not this deployment (${expectedOrigin}). Messages are reaching whatever is at that URL, not here.`;
  } else if (result.active === false) {
    severity = 'warn';
    summary = `Meta has marked the subscription to ${callbackUrl} inactive — it stops delivering while that is true`;
  }

  return {
    id: 'meta_subscription',
    severity,
    summary,
    callbackUrl,
    expectedOrigin,
    pointsElsewhere,
    fields,
    hasMessagesField,
    requiredFields: BASE_WEBHOOK_FIELDS,
    active: result.active !== false,
  };
}

/**
 * Stages 2 and 3, observed rather than inferred: what has actually arrived.
 *
 * This is the check that separates "Meta is not calling us" from "Meta is
 * calling us and we are refusing it" — two problems with the same symptom and
 * opposite fixes.
 */
export async function checkDeliveryTelemetry() {
  const telemetry = await readWebhookTelemetry();

  if (!telemetry.available) {
    return {
      id: 'delivery',
      severity: 'warn' as Severity,
      summary: `Delivery counters are unavailable (${telemetry.reason}) — they live in Redis, which this deployment cannot reach`,
      ...telemetry,
    };
  }

  const { counts, lastAt } = telemetry;
  const rejected = counts.rejected_signature + counts.rejected_unconfigured;

  let severity: Severity = 'ok';
  let summary = `${counts.accepted} delivery(ies) accepted, last at ${lastAt.accepted}`;

  if (!counts.accepted && !rejected) {
    severity = counts.verify_ok ? 'error' : 'warn';
    summary = counts.verify_ok
      ? 'Meta has verified this URL but has never POSTed a delivery to it. That is a Meta-side subscription problem, not a problem here — check the `messages` field and the WABA subscription below.'
      : 'Nothing has ever reached this endpoint — no verification and no delivery. Check that the callback URL Meta holds resolves to this deployment.';
  } else if (rejected && !counts.accepted) {
    severity = 'error';
    summary = `Every delivery has been REFUSED (${rejected} of them, last at ${lastAt.rejected_signature || lastAt.rejected_unconfigured}). Meta is reaching this endpoint; the signature check is rejecting it. The app secret is wrong or belongs to a different Meta app.`;
  } else if (rejected) {
    severity = 'warn';
    summary = `${counts.accepted} accepted, but ${rejected} refused (last refusal ${lastAt.rejected_signature || lastAt.rejected_unconfigured})`;
  }

  return { id: 'delivery', severity, summary, ...telemetry };
}

/**
 * Stage 4: an accepted payload is queued, and a queue with no worker is a
 * queue that discards nothing and delivers nothing. `getWorkers()` asks Redis
 * which consumers are actually attached right now, which no amount of local
 * process inspection can tell a multi-replica deployment.
 */
export async function checkQueueDrain() {
  const unreachable = (reason: string) => ({
    id: 'queue' as const,
    severity: 'error' as Severity,
    summary: `The inbound webhook queue is unreachable (${reason}). Accepted deliveries are processed inline as a fallback, which is slower and gives up on failure — fix REDIS_URL.`,
    queueName: WEBHOOK_QUEUE_NAME,
    counts: null,
    workerCount: null,
  });

  return withTimeout(
    (async () => {
      const queue = getWebhookQueue();
      const [counts, workers] = await Promise.all([
        queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed'),
        queue.getWorkers(),
      ]);

      const workerCount = Array.isArray(workers) ? workers.length : 0;
      const waiting = Number(counts.waiting || 0) + Number(counts.active || 0);

      let severity: Severity = 'ok';
      let summary = `${workerCount} worker(s) attached, ${waiting} job(s) in flight, ${counts.failed || 0} failed`;

      if (!workerCount) {
        severity = waiting ? 'error' : 'warn';
        summary =
          `No worker is attached to ${WEBHOOK_QUEUE_NAME}${waiting ? `, and ${waiting} accepted delivery(ies) are waiting` : ''}. ` +
          'Every replica has RUN_BACKGROUND_JOBS=false, or none of them booted the background jobs — nothing will ever be written to the inbox.';
      } else if (Number(counts.failed || 0) > 0) {
        severity = 'warn';
        summary = `${workerCount} worker(s) attached, but ${counts.failed} job(s) exhausted their retries — those are customer messages that never landed`;
      }

      return { id: 'queue' as const, severity, summary, queueName: WEBHOOK_QUEUE_NAME, counts, workerCount };
    })().catch((error: any) => unreachable(error.message)),
    QUEUE_TIMEOUT_MS,
    () => unreachable(`no answer within ${QUEUE_TIMEOUT_MS}ms`)
  );
}

/**
 * Stage 5: did processing put anything where a person can see it.
 *
 * `unowned` is the count that matters. Those rows are inbound messages that
 * were parsed and stored correctly and belong to nobody, so no inbox query
 * will ever return them — the one failure in this chain that leaves a
 * complete, healthy-looking trail behind it.
 */
export async function checkInboxLandings({ now = Date.now() }: { now?: number } = {}) {
  if (mongoose.connection.readyState !== 1) {
    return {
      id: 'inbox' as const,
      severity: 'warn' as Severity,
      summary: 'MongoDB is not connected — cannot tell whether processed messages are landing',
      recentInbound: 0,
      unownedInbound: 0,
      lastInboundAt: null,
      accounts: [],
    };
  }

  const since = new Date(now - RECENT_WINDOW_MS);
  const inboundSince = { direction: 'incoming', createdAt: { $gte: since } };

  const [recentInbound, unownedInbound, lastInbound, accounts] = await Promise.all([
    Message.countDocuments(inboundSince),
    Message.countDocuments({ ...inboundSince, $or: [{ whatsappAccountId: null }, { whatsappAccountId: { $exists: false } }] }),
    Message.findOne({ direction: 'incoming' }).sort({ createdAt: -1 }).select('createdAt').lean(),
    WhatsAppAccount.find({ status: { $ne: 'disconnected' } })
      .select('_id phoneNumberId displayPhoneNumber wabaId status isActive lastWebhookAt')
      .sort({ isActive: -1, updatedAt: -1 })
      .limit(50)
      .lean(),
  ]);

  let severity: Severity = 'ok';
  let summary = `${recentInbound} inbound message(s) in the last 24h, all owned by a connected account`;

  if (!accounts.length) {
    severity = 'error';
    summary = 'No WhatsApp account is connected on this deployment. Inbound messages have no account to belong to and no inbox to appear in.';
  } else if (unownedInbound) {
    severity = 'error';
    summary =
      `${unownedInbound} of ${recentInbound} inbound message(s) in the last 24h matched NO connected account. ` +
      'They are saved but invisible: every inbox query is scoped by owner. The number sending traffic is not one this deployment has connected.';
  } else if (!recentInbound) {
    severity = 'warn';
    summary = lastInbound
      ? `No inbound message in the last 24h. The most recent one was at ${new Date((lastInbound as any).createdAt).toISOString()}.`
      : 'No inbound message has ever been stored by this deployment.';
  }

  return {
    id: 'inbox' as const,
    severity,
    summary,
    recentInbound,
    unownedInbound,
    lastInboundAt: lastInbound ? new Date((lastInbound as any).createdAt).toISOString() : null,
    accounts: accounts.map((account: any) => ({
      accountId: String(account._id),
      phoneNumberId: account.phoneNumberId || '',
      displayPhoneNumber: account.displayPhoneNumber || '',
      wabaId: account.wabaId || '',
      status: account.status || '',
      isActive: Boolean(account.isActive),
      // Written on every matched inbound event, so it is the per-number
      // answer to "which of my connected numbers is actually receiving?"
      lastWebhookAt: account.lastWebhookAt ? new Date(account.lastWebhookAt).toISOString() : null,
    })),
  };
}

/**
 * The whole chain, in delivery order. `includeWabaSubscriptions` adds one
 * Graph call per connected WABA — worth it here, unlike at boot, because the
 * report is requested by a person who is already stuck.
 */
export async function runWebhookDiagnostics({
  expectedOrigin = '',
  includeWabaSubscriptions = true,
}: { expectedOrigin?: string; includeWabaSubscriptions?: boolean } = {}) {
  const [endpoint, meta, delivery, queue, inbox] = await Promise.all([
    Promise.resolve(checkEndpointConfig()),
    checkMetaSubscription({ expectedOrigin }),
    checkDeliveryTelemetry(),
    checkQueueDrain(),
    checkInboxLandings().catch((error: any) => {
      logger.error('[webhook-diagnostics] inbox check failed:', error.message);
      return {
        id: 'inbox' as const,
        severity: 'warn' as Severity,
        summary: `Could not read message history: ${error.message}`,
        recentInbound: 0,
        unownedInbound: 0,
        lastInboundAt: null,
        accounts: [],
      };
    }),
  ]);

  const checks: any[] = [endpoint, meta, delivery, queue, inbox];

  if (includeWabaSubscriptions) {
    const accounts = await WhatsAppAccount.find({ status: { $ne: 'disconnected' } })
      .select('_id phoneNumberId wabaId accessTokenEncrypted')
      .limit(50)
      .lean()
      .catch(() => []);
    checks.splice(2, 0, await checkWabaSubscriptions(accounts as any[], { graphVersion: getGraphApiVersion() }));
  }

  // The first failing stage, in delivery order — the one to fix first, since
  // every later stage is downstream of it and may only look broken because
  // nothing is reaching it.
  const firstFailure = checks.find((check) => check.severity === 'error') || null;

  return {
    checkedAt: new Date().toISOString(),
    severity: worstSeverity(checks),
    firstFailure: firstFailure ? { id: firstFailure.id, summary: firstFailure.summary } : null,
    checks,
  };
}
