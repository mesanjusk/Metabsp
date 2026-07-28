import { NextRequest } from 'next/server';
import { getRedisConnection } from '../db/redis';
import logger from '../utils/logger';

// Next.js-native re-implementation of backend/src/middleware/rateLimit.js's
// intent (same Redis-backed fixed-window approach, same fail-open-on-
// Redis-error behavior) — express-rate-limit/rate-limit-redis are Express
// middleware and have no Route Handler equivalent, so this is a small,
// purpose-built fixed-window counter over the SAME shared Redis connection
// instead. Key prefix ('rl:') and windows match the original so the two
// apps' limits don't compound oddly if both are ever live against the same
// endpoint during a staged cutover.
const REDIS_COMMAND_TIMEOUT_MS = 2500;

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error('[rateLimit] Redis command timed out')), REDIS_COMMAND_TIMEOUT_MS)
    ),
  ]);
}

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  key: string; // caller supplies the key (per-user id or per-IP), see getClientIp
  prefix: 'user' | 'auth';
}

// Returns true if the request is allowed, false if the limit is exceeded.
// Fails OPEN (returns true) on a Redis error/timeout — availability over
// strict limiting during a transient infra failure, same tradeoff the
// original's passOnStoreError:true made.
export async function checkRateLimit({ windowMs, maxRequests, key, prefix }: RateLimitOptions): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const redisKey = `rl:${prefix}:${key}`;
    const count = await withTimeout(redis.incr(redisKey));
    if (count === 1) {
      await withTimeout(redis.pexpire(redisKey, windowMs));
    }
    return count <= maxRequests;
  } catch (error: any) {
    logger.warn('[rateLimit] Redis unavailable, allowing request:', error.message);
    return true;
  }
}

// Convenience wrapper for the unauthenticated auth/OTP endpoints (login,
// signup OTP request/verify, password reset) — keyed by IP, same as
// createAuthRateLimiter in the original.
export async function checkAuthRateLimit(req: NextRequest, { windowMs, maxRequests }: { windowMs: number; maxRequests: number }): Promise<boolean> {
  return checkRateLimit({ windowMs, maxRequests, key: getClientIp(req), prefix: 'auth' });
}

// Convenience wrapper for authenticated endpoints (connect, messaging) —
// keyed by user id, same as createRateLimiter in the original.
export async function checkUserRateLimit(
  userId: string,
  { windowMs, maxRequests }: { windowMs: number; maxRequests: number }
): Promise<boolean> {
  return checkRateLimit({ windowMs, maxRequests, key: userId, prefix: 'user' });
}
