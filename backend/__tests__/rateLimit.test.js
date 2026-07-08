const express = require('express');
const request = require('supertest');
const { createAuthRateLimiter } = require('../src/middleware/rateLimit');

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
