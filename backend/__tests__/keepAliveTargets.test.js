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
