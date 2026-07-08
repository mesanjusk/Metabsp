const request = require('supertest');

describe('trust proxy configuration', () => {
  const originalValue = process.env.TRUST_PROXY;

  afterEach(() => {
    if (originalValue === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalValue;
    jest.resetModules();
  });

  it('defaults to trusting 1 proxy hop when TRUST_PROXY is unset', async () => {
    delete process.env.TRUST_PROXY;
    jest.resetModules();
    const app = require('../src/app');

    const res = await request(app).get('/').set('X-Forwarded-For', '203.0.113.5, 10.0.0.1');
    expect(res.status).toBe(200);
    expect(app.get('trust proxy')).toBe(1);
  });

  it('parses an explicit hop count', async () => {
    process.env.TRUST_PROXY = '2';
    jest.resetModules();
    const app = require('../src/app');
    expect(app.get('trust proxy')).toBe(2);
  });

  it('parses "false" as trusting no proxy', async () => {
    process.env.TRUST_PROXY = 'false';
    jest.resetModules();
    const app = require('../src/app');
    expect(app.get('trust proxy')).toBe(false);
  });

  it('parses "true" as trusting all proxies', async () => {
    process.env.TRUST_PROXY = 'true';
    jest.resetModules();
    const app = require('../src/app');
    expect(app.get('trust proxy')).toBe(true);
  });
});
