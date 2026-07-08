const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

// Backed by express-rate-limit (in-memory store) instead of the previous
// hand-rolled Map — same per-instance limitation (resets on restart, not
// shared across horizontally-scaled instances) until Phase 2 swaps in a
// Redis store, but gets correct RateLimit-* headers and battle-tested
// window/key handling for free. Keyed by authenticated user id when
// available, falling back to IP, same as before.
const createRateLimiter = ({ windowMs, maxRequests }) =>
  rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
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
    keyGenerator: (req) => req.ip,
    handler: (_req, _res, next) => {
      next(new AppError('Too many attempts. Please try again later.', 429));
    },
  });

module.exports = { createRateLimiter, createAuthRateLimiter };
