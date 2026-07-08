const request = require('supertest');

// src/app.js only wires up Express — no DB connection is attempted at
// require time, so this exercises real route/middleware behavior (helmet
// headers, CORS, 404 handling, health check) without needing a live Mongo
// connection or mongodb-memory-server.
const app = require('../src/app');

describe('GET /', () => {
  it('returns a 200 ok payload', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('GET /health', () => {
  it('reports db disconnected (503) when Mongo is not connected', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ ok: false, db: 'disconnected' });
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
  });
});

describe('security headers', () => {
  it('sets helmet defaults (e.g. X-Content-Type-Options)', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('does not leak the Express fingerprint header', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('unknown routes', () => {
  it('falls through to the 404 handler', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
  });
});
