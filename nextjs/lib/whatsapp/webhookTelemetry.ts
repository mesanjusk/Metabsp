import { getRedisConnection } from '../db/redis';
import logger from '../utils/logger';

/**
 * What actually arrived at the webhook endpoint, recorded so the question
 * "is Meta even reaching us?" can be answered without log access.
 *
 * The failure this exists for: a callback URL that verifies (the GET
 * handshake needs only the verify token) while every POST is refused, or
 * accepted and then lost downstream. From the Meta App Dashboard all three
 * look identical — a saved subscription with fields ticked — and the only
 * difference is visible here.
 *
 * Everything is best-effort. A counter that cannot be written must never
 * cost a customer their message, so every call swallows its error, and
 * every Redis command is bounded: `getRedisConnection()` sets
 * `maxRetriesPerRequest: null` with the offline queue on, which means a
 * command issued while Redis is unreachable waits forever rather than
 * failing. That is the same trap the handler's enqueue had to be bounded
 * against; see handleReceiveWebhook.
 */
const KEY_PREFIX = 'wh:telemetry:';
const REDIS_COMMAND_TIMEOUT_MS = 1500;

// Long enough to answer "did anything arrive since we changed the URL?" days
// later, short enough that the keys expire on their own if the deployment is
// abandoned.
const RETENTION_SECONDS = 30 * 24 * 60 * 60;

export type WebhookOutcome =
  // A signed (or signature-disabled) whatsapp_business_account payload that
  // was accepted for processing. The only outcome that can end in the inbox.
  | 'accepted'
  // Refused: the signature did not match META_APP_SECRET, or was absent.
  | 'rejected_signature'
  // Refused: enforcement is on but no app secret is configured at all.
  | 'rejected_unconfigured'
  // Accepted and deliberately dropped — another product sharing this URL.
  | 'ignored_object'
  // GET handshake outcomes, so a re-verification in Meta's dashboard is
  // distinguishable from silence.
  | 'verify_ok'
  | 'verify_rejected';

export const WEBHOOK_OUTCOMES: WebhookOutcome[] = [
  'accepted',
  'rejected_signature',
  'rejected_unconfigured',
  'ignored_object',
  'verify_ok',
  'verify_rejected',
];

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error('Redis command timed out')), REDIS_COMMAND_TIMEOUT_MS)
    ),
  ]);
}

/**
 * One delivery, one outcome. Never awaited on the request path in a way that
 * can delay Meta's acknowledgement — call it, do not block on it.
 */
export async function recordWebhookOutcome(outcome: WebhookOutcome, at: Date = new Date()): Promise<void> {
  try {
    const redis = getRedisConnection();
    const countKey = `${KEY_PREFIX}count:${outcome}`;
    const lastKey = `${KEY_PREFIX}last:${outcome}`;

    await withTimeout(
      redis
        .multi()
        .incr(countKey)
        .expire(countKey, RETENTION_SECONDS)
        .set(lastKey, at.toISOString(), 'EX', RETENTION_SECONDS)
        .exec()
    );
  } catch (error: any) {
    // Deliberately debug, not warn: Redis being unreachable is already
    // reported loudly by the enqueue path, and this must not add a line per
    // delivery to that noise.
    logger.debug('[webhook-telemetry] Could not record outcome:', error.message);
  }
}

export interface WebhookTelemetry {
  available: boolean;
  reason?: string;
  counts: Record<WebhookOutcome, number>;
  lastAt: Record<WebhookOutcome, string | null>;
}

const emptyTelemetry = (reason: string): WebhookTelemetry => ({
  available: false,
  reason,
  counts: Object.fromEntries(WEBHOOK_OUTCOMES.map((o) => [o, 0])) as Record<WebhookOutcome, number>,
  lastAt: Object.fromEntries(WEBHOOK_OUTCOMES.map((o) => [o, null])) as Record<WebhookOutcome, string | null>,
});

/**
 * Reads back every counter in one round trip. Reports `available: false`
 * rather than throwing when Redis cannot answer — an unreachable Redis is
 * itself one of the diagnoses the caller is trying to make, so it must be
 * reportable rather than fatal.
 */
export async function readWebhookTelemetry(): Promise<WebhookTelemetry> {
  try {
    const redis = getRedisConnection();
    const keys = [
      ...WEBHOOK_OUTCOMES.map((o) => `${KEY_PREFIX}count:${o}`),
      ...WEBHOOK_OUTCOMES.map((o) => `${KEY_PREFIX}last:${o}`),
    ];
    const values = await withTimeout(redis.mget(...keys));

    const counts = {} as Record<WebhookOutcome, number>;
    const lastAt = {} as Record<WebhookOutcome, string | null>;
    WEBHOOK_OUTCOMES.forEach((outcome, index) => {
      counts[outcome] = Number(values[index] || 0);
      lastAt[outcome] = values[index + WEBHOOK_OUTCOMES.length] || null;
    });

    return { available: true, counts, lastAt };
  } catch (error: any) {
    return emptyTelemetry(error.message);
  }
}
