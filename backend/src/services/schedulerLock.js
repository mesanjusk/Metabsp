const crypto = require('crypto');
const { getRedisConnection } = require('../config/redis');
const logger = require('../utils/logger');

const INSTANCE_ID = crypto.randomBytes(8).toString('hex');
const DEFAULT_TTL_MS = 5 * 60 * 1000; // generous cap for a single scheduled batch run

// Ensures only one API replica actually executes a given scheduled task on
// any given tick. Every replica boots these schedulers in-process on its own
// setInterval with no coordination (see docs/deployment/HIGH_AVAILABILITY.md)
// — this closes that gap without a long-held lock + renewal loop: a
// short-lived per-tick Redis lock is enough, since all replicas' timers fire
// on the same cadence and only need to race once per cycle. A dead lock
// holder self-heals via TTL expiry rather than requiring an explicit release.
async function withLeaderLock(lockName, fn, { ttlMs = DEFAULT_TTL_MS } = {}) {
  const redis = getRedisConnection();
  const key = `scheduler-lock:${lockName}`;
  let acquired = true;
  try {
    const result = await redis.set(key, INSTANCE_ID, 'PX', ttlMs, 'NX');
    acquired = result === 'OK';
  } catch (error) {
    // Redis unreachable — fail open (run anyway) rather than silently never
    // running scheduled work because the lock check itself failed. Duplicate
    // execution during a Redis outage is the same risk this app already
    // accepted before leader election existed; this only adds protection
    // during normal operation, not a hard dependency on Redis being up.
    logger.error(`[scheduler-lock] ${lockName}: lock check failed, running anyway:`, error.message);
    acquired = true;
  }

  if (!acquired) {
    logger.debug(`[scheduler-lock] ${lockName}: another replica holds the lock this cycle — skipping.`);
    return undefined;
  }

  return fn();
}

module.exports = { withLeaderLock };
