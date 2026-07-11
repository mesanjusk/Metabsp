const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const AppError = require('../utils/AppError');
const { getRedisConnection } = require('../config/redis');
const logger = require('../utils/logger');

// Backed by Redis (via the same ioredis connection the broadcast queue
// uses) instead of express-rate-limit's default in-memory store, so limits
// are actually enforced consistently across horizontally-scaled instances
// and survive a process restart — the previous in-memory version reset per
// instance and per deploy, giving a false sense of protection at scale.
let sharedStorePrefix = 'rl:';

// getRedisConnection() is configured with maxRetriesPerRequest: null for
// BullMQ's sake, which means a command issued while Redis is unreachable
// queues silently and its promise never settles — not even a rejection.
// Without this timeout, passOnStoreError below is dead code: express-rate-
// limit only falls back to "allow the request" on a *rejected* store call,
// so a Redis outage would otherwise hang every login/OTP request forever
// instead of degrading to no rate limiting.
const REDIS_COMMAND_TIMEOUT_MS = 2500;
const sendCommandWithTimeout = (...args) => {
  const raced = Promise.race([
    getRedisConnection().call(...args),
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error('[rateLimit] Redis command timed out')), REDIS_COMMAND_TIMEOUT_MS)
    ),
  ]);
  // rate-limit-redis's RedisStore eagerly loads a script for its .get()
  // method that this app never calls anywhere, so that particular call's
  // result is never awaited by anyone else. Attaching a no-op catch here —
  // on this exact promise, not a derived one — marks it "handled" for
  // Node's unhandled-rejection bookkeeping without affecting the real
  // awaiter on the (used) increment path: multiple independent .catch/await
  // calls on the same promise each still see its rejection normally: this
  // one just stops it from being reported as unhandled if nothing else
  // ever awaits this particular call.
  raced.catch(() => {});
  return raced;
};

const buildStore = (prefix) => {
  try {
    return new RedisStore({
      sendCommand: sendCommandWithTimeout,
      prefix: `${sharedStorePrefix}${prefix}:`,
    });
  } catch (error) {
    logger.warn('[rateLimit] Falling back to in-memory store — Redis store init failed:', error.message);
    return undefined; // express-rate-limit's own default MemoryStore
  }
};

const createRateLimiter = ({ windowMs, maxRequests }) =>
  rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore('user'),
    // A Redis outage should degrade to "no rate limiting" rather than take
    // down messaging/API routes entirely — availability over strict
    // limiting during a transient infra failure.
    passOnStoreError: true,
    keyGenerator: (req) => req.user?.id || req.ip,
    handler: (_req, _res, next) => {
      next(new AppError('Rate limit exceeded. Please retry later.', 429));
    },
  });

// Stricter limiter for unauthenticated auth/OTP endpoints (login, signup OTP
// request, password reset) which have no req.user to key on and are the
// highest-value brute-force/enumeration targets.
const createAuthRateLimiter = ({ windowMs, maxRequests }) =>
  rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore('auth'),
    passOnStoreError: true,
    keyGenerator: (req) => req.ip,
    handler: (_req, _res, next) => {
      next(new AppError('Too many attempts. Please try again later.', 429));
    },
  });

module.exports = { createRateLimiter, createAuthRateLimiter };
