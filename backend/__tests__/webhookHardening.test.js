const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');

describe('POST /webhook — object-type and signature hardening', () => {
  const originalEnforce = process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE;
  const originalSecret = process.env.META_APP_SECRET;

  afterEach(() => {
    if (originalEnforce === undefined) delete process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE;
    else process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE = originalEnforce;
    if (originalSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = originalSecret;
  });

  it('acknowledges but ignores a non-WhatsApp object payload (e.g. a Page webhook sharing the same URL)', async () => {
    process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE = 'false';

    const res = await request(app).post('/webhook').send({ object: 'page', entry: [{ id: '123', changes: [] }] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, ignored: true });
  });

  it('processes a whatsapp_business_account payload normally (not ignored)', async () => {
    process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE = 'false';

    const res = await request(app).post('/webhook').send({ object: 'whatsapp_business_account', entry: [] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('processes a payload with no object field at all (backward compatible)', async () => {
    process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE = 'false';

    const res = await request(app).post('/webhook').send({ entry: [] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('rejects a webhook with an invalid signature when enforcement is on', async () => {
    process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE = 'true';
    process.env.META_APP_SECRET = 'test-secret';

    const res = await request(app)
      .post('/webhook')
      .set('X-Hub-Signature-256', 'sha256=deadbeef')
      .send({ object: 'whatsapp_business_account', entry: [] });

    expect(res.status).toBe(403);
  });

  it('accepts a webhook with a correctly signed body', async () => {
    process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE = 'true';
    process.env.META_APP_SECRET = 'test-secret';

    const body = { object: 'whatsapp_business_account', entry: [] };
    const rawBody = JSON.stringify(body);
    const signature = 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(rawBody).digest('hex');

    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });
});
