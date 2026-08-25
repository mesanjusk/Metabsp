jest.mock('../src/models/WebhookDestination', () => ({
  find: jest.fn(),
}));

const request = require('supertest');
const WebhookDestination = require('../src/models/WebhookDestination');
const app = require('../src/app');

describe('GET /api/whatsapp/webhook-destinations/keep-alive-targets', () => {
  afterEach(() => {
    WebhookDestination.find.mockReset();
  });

  it('is unauthenticated and returns only label + url for active destinations, no secrets', async () => {
    WebhookDestination.find.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            { label: 'Print-Mart', url: 'https://print-mart-dv0h.onrender.com/api/whatsapp/webhook-metabsp', secret: 'super-secret' },
          ]),
      }),
    });

    const res = await request(app).get('/api/whatsapp/webhook-destinations/keep-alive-targets');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      targets: [{ label: 'Print-Mart', url: 'https://print-mart-dv0h.onrender.com/api/whatsapp/webhook-metabsp' }],
    });
    expect(JSON.stringify(res.body)).not.toMatch(/super-secret/);
    expect(WebhookDestination.find).toHaveBeenCalledWith({ isActive: true });
  });

  it('returns an empty list rather than erroring when there are no active destinations', async () => {
    WebhookDestination.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });

    const res = await request(app).get('/api/whatsapp/webhook-destinations/keep-alive-targets');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, targets: [] });
  });
});

// The endpoint lists every tenant's webhook URL to any caller. Locking it
// outright would break whatever cron is currently pinging it, so the gate is
// opt-in: it engages only once KEEP_ALIVE_TOKEN is set, letting the pinger be
// configured first.
describe('KEEP_ALIVE_TOKEN gate', () => {
  const originalToken = process.env.KEEP_ALIVE_TOKEN;

  const mockOneDestination = () => {
    WebhookDestination.find.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([{ label: 'Print-Mart', url: 'https://example.test/hook' }]) }),
    });
  };

  afterEach(() => {
    if (originalToken === undefined) delete process.env.KEEP_ALIVE_TOKEN;
    else process.env.KEEP_ALIVE_TOKEN = originalToken;
    WebhookDestination.find.mockReset();
  });

  it('stays open when the variable is unset, so an existing pinger keeps working', async () => {
    delete process.env.KEEP_ALIVE_TOKEN;
    mockOneDestination();

    const res = await request(app).get('/api/whatsapp/webhook-destinations/keep-alive-targets');
    expect(res.status).toBe(200);
  });

  it('rejects a caller with no token once the variable is set', async () => {
    process.env.KEEP_ALIVE_TOKEN = 'expected-token';
    mockOneDestination();

    const res = await request(app).get('/api/whatsapp/webhook-destinations/keep-alive-targets');
    expect(res.status).toBe(401);
    // The gate must run before the query — nothing should be read at all.
    expect(WebhookDestination.find).not.toHaveBeenCalled();
  });

  it('rejects a wrong token', async () => {
    process.env.KEEP_ALIVE_TOKEN = 'expected-token';
    mockOneDestination();

    const res = await request(app)
      .get('/api/whatsapp/webhook-destinations/keep-alive-targets')
      .set('X-Keep-Alive-Token', 'wrong');
    expect(res.status).toBe(401);
  });

  it('accepts the right token in the header', async () => {
    process.env.KEEP_ALIVE_TOKEN = 'expected-token';
    mockOneDestination();

    const res = await request(app)
      .get('/api/whatsapp/webhook-destinations/keep-alive-targets')
      .set('X-Keep-Alive-Token', 'expected-token');
    expect(res.status).toBe(200);
    expect(res.body.targets).toHaveLength(1);
  });

  it('accepts the right token in the query string, for pingers that cannot set headers', async () => {
    process.env.KEEP_ALIVE_TOKEN = 'expected-token';
    mockOneDestination();

    const res = await request(app).get(
      '/api/whatsapp/webhook-destinations/keep-alive-targets?token=expected-token'
    );
    expect(res.status).toBe(200);
  });
});
