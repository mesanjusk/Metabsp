import crypto from 'crypto';
import { getRedisConnection } from '../db/redis';
import logger from '../utils/logger';

const INSTANCE_ID = crypto.randomBytes(8).toString('hex');
const DEFAULT_TTL_MS = 5 * 60 * 1000; // generous cap for a single scheduled batch run

/**
 * Ensures only one replica actually executes a given scheduled task on any
 * given tick. Every replica boots the schedulers in-process on its own timer
 * with no coordination; this closes that gap without a long-held lock plus a
 * renewal loop. A short-lived per-tick Redis lock is enough, since all
 * replicas' timers fire on the same cadence and only need to race once per
 * cycle. A dead lock holder self-heals via TTL expiry rather than needing an
 * explicit release.
 */
export async function withLeaderLock<T>(
  lockName: string,
  fn: () => Promise<T> | T,
  { ttlMs = DEFAULT_TTL_MS }: { ttlMs?: number } = {}
): Promise<T | undefined> {
  const redis = getRedisConnection();
  const key = `scheduler-lock:${lockName}`;
  let acquired = true;

  try {
    const result = await (redis as any).set(key, INSTANCE_ID, 'PX', ttlMs, 'NX');
    acquired = result === 'OK';
  } catch (error: any) {
    // Redis unreachable — fail open (run anyway) rather than silently never
    // running scheduled work because the lock check itself failed. Duplicate
    // execution during a Redis outage is the same risk this app accepted
    // before leader election existed; this adds protection during normal
    // operation, not a hard dependency on Redis being up.
    logger.error(`[scheduler-lock] ${lockName}: lock check failed, running anyway:`, error.message);
    acquired = true;
  }

  if (!acquired) {
    logger.debug(`[scheduler-lock] ${lockName}: another replica holds the lock this cycle — skipping.`);
    return undefined;
  }

  return fn();
}
