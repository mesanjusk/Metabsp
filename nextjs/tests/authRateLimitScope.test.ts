import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Each auth endpoint gets its own budget.
 *
 * Every caller of checkAuthRateLimit used to share the single Redis key
 * `rl:auth:<ip>` while passing its own maxRequests — 5 for the signup and
 * password-reset OTP requests, 10 for the verify steps, 20 for login. One
 * counter compared against five thresholds meant the budgets compounded, so
 * ordinary use of one endpoint throttled the others and the strictest limit
 * governed the whole window. These tests pin the per-endpoint namespacing.
 */

const store = vi.hoisted(() => ({ counts: new Map<string, number>() }));

vi.mock('@/lib/db/redis', () => ({
  getRedisConnection: () => ({
    incr: async (key: string) => {
      const next = (store.counts.get(key) || 0) + 1;
      store.counts.set(key, next);
      return next;
    },
    pexpire: async () => 1,
  }),
}));

const { checkAuthRateLimit } = await import('@/lib/http/rateLimit');

const req = (ip = '203.0.113.7') =>
  ({ headers: new Headers({ 'x-forwarded-for': ip }) } as any);

const WINDOW = 15 * 60 * 1000;

describe('auth rate limit scoping', () => {
  beforeEach(() => {
    store.counts.clear();
  });

  it('does not spend the login budget on signup traffic', async () => {
    // Exhaust the signup OTP budget entirely (limit 5, so the 6th is refused).
    for (let i = 0; i < 5; i += 1) {
      await expect(
        checkAuthRateLimit(req(), { windowMs: WINDOW, maxRequests: 5, scope: 'signup-otp' })
      ).resolves.toBe(true);
    }
    await expect(
      checkAuthRateLimit(req(), { windowMs: WINDOW, maxRequests: 5, scope: 'signup-otp' })
    ).resolves.toBe(false);

    // Login from the same IP must still have its full allowance.
    for (let i = 0; i < 20; i += 1) {
      await expect(
        checkAuthRateLimit(req(), { windowMs: WINDOW, maxRequests: 20, scope: 'login' })
      ).resolves.toBe(true);
    }
  });

  it('keeps the signup OTP request and verify steps on separate budgets', async () => {
    for (let i = 0; i < 5; i += 1) {
      await checkAuthRateLimit(req(), { windowMs: WINDOW, maxRequests: 5, scope: 'signup-otp' });
    }

    // Verifying the code that was just sent must not be refused because
    // requesting it used up the shared allowance.
    await expect(
      checkAuthRateLimit(req(), { windowMs: WINDOW, maxRequests: 10, scope: 'signup-verify' })
    ).resolves.toBe(true);
  });

  it('still limits a single endpoint, per IP', async () => {
    for (let i = 0; i < 5; i += 1) {
      await checkAuthRateLimit(req('198.51.100.1'), { windowMs: WINDOW, maxRequests: 5, scope: 'signup-otp' });
    }

    await expect(
      checkAuthRateLimit(req('198.51.100.1'), { windowMs: WINDOW, maxRequests: 5, scope: 'signup-otp' })
    ).resolves.toBe(false);

    // A different address is unaffected.
    await expect(
      checkAuthRateLimit(req('198.51.100.2'), { windowMs: WINDOW, maxRequests: 5, scope: 'signup-otp' })
    ).resolves.toBe(true);
  });

  it('namespaces the key by scope and IP', async () => {
    await checkAuthRateLimit(req('192.0.2.9'), { windowMs: WINDOW, maxRequests: 5, scope: 'signup-otp' });
    await checkAuthRateLimit(req('192.0.2.9'), { windowMs: WINDOW, maxRequests: 20, scope: 'login' });

    expect([...store.counts.keys()].sort()).toEqual([
      'rl:auth:login:192.0.2.9',
      'rl:auth:signup-otp:192.0.2.9',
    ]);
  });
});
