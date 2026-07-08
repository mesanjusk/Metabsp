const request = require('supertest');
const app = require('../src/app');

describe('GET /api-docs.json', () => {
  it('serves the raw OpenAPI spec as JSON', async () => {
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/api/v1/baileys/send']).toBeDefined();
    expect(res.body.paths['/api/whatsapp/workflows']).toBeDefined();
  });
});

describe('GET /api-docs', () => {
  it('serves the Swagger UI page without a blocking CSP header', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.text).toContain('swagger-ui');
  });
});
