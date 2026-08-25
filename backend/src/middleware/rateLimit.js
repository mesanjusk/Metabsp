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
  // Marks this exact promise "handled" for Node's unhandled-rejection
  // bookkeeping. Independent .catch/await calls on the same promise each
  // still see its rejection normally, so the real awaiter on the increment
  // path is unaffected.
  //
  // This covers only `raced` itself. RedisStore wraps this function in its
  // own async lambda, so anything it chains is a *derived* promise that this
  // catch says nothing about — see silenceEagerScriptLoads below for the two
  // constructor-time loads that fall in that gap.
  raced.catch(() => {});
  return raced;
};

// RedisStore's constructor kicks off two SCRIPT LOAD calls and parks the
// promises on `incrementScriptSha` / `getScriptSha` without awaiting either.
// Nothing awaits them until the first request arrives, so when Redis is cold
// at boot both reject with nobody listening and Node reports them as
// unhandled rejections — six lines of alarming stack traces per start (three
// limiters × two scripts) for what is really just "Redis isn't up yet".
//
// The no-op catch inside sendCommandWithTimeout can't cover these: the store
// wraps our function in its own `async ({command}) => …`, so what rejects
// here is a *derived* promise, and marking the original handled says nothing
// about its descendants. Marking them handled has to happen on these exact
// promises, after construction.
//
// This suppresses the report only. `retryableIncrement` still awaits the same
// promise and still sees the rejection, so a genuine failure on the request
// path is unchanged — it surfaces there and `passOnStoreError` below decides
// what to do about it.
const silenceEagerScriptLoads = (store) => {
  for (const field of ['incrementScriptSha', 'getScriptSha']) {
    const pending = store?.[field];
    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
  }
  return store;
};

const buildStore = (prefix) => {
  try {
    return silenceEagerScriptLoads(
      new RedisStore({
        sendCommand: sendCommandWithTimeout,
        prefix: `${sharedStorePrefix}${prefix}:`,
      })
    );
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
