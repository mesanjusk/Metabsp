import { ProviderOverloadedError } from "@/lib/video/core/ai/types";

/**
 * How long to wait before the next attempt, decided by what actually went wrong.
 *
 * BullMQ's built-in `exponential` backoff takes one delay for every failure a queue can have, which
 * is fine when they all have the same shape and wrong here, because two of ours do not:
 *
 *   • A provider overload (HTTP 503, "experiencing high demand") is weather. Google says so in the
 *     body: "Spikes in demand are usually temporary. Please try again later." It passes in minutes.
 *   • Everything else — a malformed prompt, a missing asset, a bug — fails the same way every time.
 *     Waiting minutes for those only delays the error someone needs to read.
 *
 * The default policy was three attempts at a 5s exponential backoff, which retries at 0s, 5s and
 * 15s and then gives up — the entire budget spent a quarter of a minute after the first failure.
 * Against a demand spike that is not a retry policy, it is three requests fired into the same
 * moment. The customer saw "Something went wrong" and a page of raw API JSON for a condition that
 * would have cleared on its own.
 *
 * So overloads get their own scale: minutes, not seconds, and more attempts to spend them on.
 * Everything else keeps the fast schedule it always had, because failing fast on a real failure is
 * the correct behaviour.
 */

/** Ceiling on a single wait. Long enough to outlast a spike, short enough to notice a real outage. */
export const MAX_BACKOFF_MS = 10 * 60 * 1000;

/** First wait after an overload. Anything under ~30s tends to land inside the same spike. */
const OVERLOAD_BASE_MS = 30_000;

/** First wait for an ordinary transient failure — the schedule this queue has always used. */
const DEFAULT_BASE_MS = 5_000;

/**
 * Up to ±20% of jitter.
 *
 * Every scene in a project fails at the same instant when the provider goes down, so a pure
 * exponential schedule retries all eight of them at the same instant too — a thundering herd
 * aimed at the one service that just said it was overloaded. Spreading them costs nothing and is
 * the difference between probing a recovering provider and re-loading it.
 */
function jitter(ms: number): number {
  return Math.round(ms * (0.8 + Math.random() * 0.4));
}

export function isOverloadError(err: unknown): boolean {
  return err instanceof ProviderOverloadedError;
}

/**
 * The strategy BullMQ calls between attempts.
 *
 * `attemptsMade` is 1 on the first failure. Signature matches BullMQ's `backoffStrategy`, whose
 * later arguments this does not need — the error alone decides the scale.
 */
export function computeBackoffMs(attemptsMade: number, err?: unknown): number {
  const base = isOverloadError(err) ? OVERLOAD_BASE_MS : DEFAULT_BASE_MS;
  const exponential = base * Math.pow(2, Math.max(0, attemptsMade - 1));
  // Clamped last, so the ceiling bounds the wait actually returned. Clamping first and then adding
  // up to +20% of jitter let a late attempt exceed it.
  return Math.min(jitter(exponential), MAX_BACKOFF_MS);
}

/**
 * Wired into every Worker this app creates, so a job's retry schedule does not depend on which
 * process happened to pick it up. Referencing it from one module is what keeps the persistent
 * worker and the serverless tick honest about that.
 */
export const backoffStrategy = (attemptsMade: number, _type?: string, err?: Error): number =>
  computeBackoffMs(attemptsMade, err);
