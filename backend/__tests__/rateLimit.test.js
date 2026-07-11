const express = require('express');
const request = require('supertest');
const { createAuthRateLimiter } = require('../src/middleware/rateLimit');
const { getRedisConnection, closeRedisConnection } = require('../src/config/redis');

describe('middleware/rateLimit createAuthRateLimiter', () => {
  const buildApp = (maxRequests) => {
    const app = express();
    app.use(createAuthRateLimiter({ windowMs: 60_000, maxRequests }));
    app.post('/login', (_req, res) => res.status(200).json({ ok: true }));
    app.use((err, _req, res, _next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message });
    });
    return app;
  };

  // The rate limiter is now backed by real Redis (shared across test runs
  // in this same process/environment), so each test needs a clean slate —
  // otherwise counts left over from a previous run of this same suite would
  // make "allows requests under the limit" flaky.
  beforeEach(async () => {
    const redis = getRedisConnection();
    const keys = await redis.keys('rl:auth:*');
    if (keys.length) await redis.del(keys);
  });

  afterAll(async () => {
    await closeRedisConnection();
  });

  it('allows requests under the limit', async () => {
    const app = buildApp(3);
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/login');
      expect(res.status).toBe(200);
    }
  });

  it('rejects requests once the limit is exceeded, with a 429', async () => {
    const app = buildApp(2);
    await request(app).post('/login');
    await request(app).post('/login');
    const blocked = await request(app).post('/login');

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
  });
});

describe('middleware/rateLimit createAuthRateLimiter when Redis is unreachable', () => {
  // Regression test for a real production incident: getRedisConnection()
  // uses maxRetriesPerRequest: null (required by BullMQ elsewhere), so a
  // command sent while Redis is down never resolves *or* rejects — it just
  // queues forever. That silently defeated passOnStoreError, which only
  // triggers on a rejected store call, so every login/OTP request hung
  // until the client gave up. Login/signup/forgot-password all share this
  // limiter, so this hung every auth flow, not just login.
  it('times out the stalled Redis call and lets the request through instead of hanging', async () => {
    jest.resetModules();
    jest.doMock('../src/config/redis', () => ({
      getRedisConnection: () => ({
        // rate-limit-redis's RedisStore constructor eagerly loads a script
        // for its unused .get() method alongside the increment one this
        // flow actually exercises. Resolving that one immediately (real
        // Redis would too — SCRIPT LOAD is near-instant when reachable)
        // keeps this test focused on what it's meant to prove: the
        // increment path times out and degrades gracefully instead of
        // hanging, without leaving an unrelated dangling promise around.
        call: (...args) => {
          const isUnusedGetScriptLoad =
            args[0] === 'SCRIPT' && args[1] === 'LOAD' && typeof args[2] === 'string' && !args[2].includes('INCR');
          return isUnusedGetScriptLoad ? Promise.resolve('unused-get-script-sha') : new Promise(() => {});
        },
      }),
    }));

    const { createAuthRateLimiter } = require('../src/middleware/rateLimit');
    const app = express();
    app.use(createAuthRateLimiter({ windowMs: 60_000, maxRequests: 3 }));
    app.post('/login', (_req, res) => res.status(200).json({ ok: true }));

    const res = await request(app).post('/login');
    expect(res.status).toBe(200);

    jest.dontMock('../src/config/redis');
    jest.resetModules();
  }, 5000);
});
