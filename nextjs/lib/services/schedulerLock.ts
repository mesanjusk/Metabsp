import crypto from 'crypto';
import { getRedisConnection } from '../db/redis';
import logger from '../utils/logger';

// Ported from backend/src/services/schedulerLock.js, unchanged in behaviour.
//
// Render can run more than one instance of a service. Every instance boots the
// schedulers on its own timer with no coordination, so without this each tick
// would run once per replica — token refresh would re-exchange the same token
// concurrently, and invoices would be raised twice.
//
// A short per-tick lock is enough rather than a held lease with renewal: all
// replicas' timers fire on the same cadence and only need to race once per
// cycle, and a dead holder self-heals when the TTL expires.

const INSTANCE_ID = crypto.randomBytes(8).toString('hex');
const DEFAULT_TTL_MS = 5 * 60 * 1000; // generous cap for a single batch run

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
    // Redis unreachable — fail open rather than silently never running
    // scheduled work because the lock check itself failed. Duplicate execution
    // during a Redis outage is the risk this app already accepted before
    // leader election existed; this adds protection during normal operation,
    // not a hard dependency on Redis being up.
    logger.error(`[scheduler-lock] ${lockName}: lock check failed, running anyway: ${error.message}`);
    acquired = true;
  }

  if (!acquired) {
    logger.debug(`[scheduler-lock] ${lockName}: another replica holds the lock this cycle — skipping.`);
    return undefined;
  }

  return fn();
}
