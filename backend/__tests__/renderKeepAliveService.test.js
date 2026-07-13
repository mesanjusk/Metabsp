jest.mock('axios');
jest.mock('../src/models/WebhookDestination', () => ({
  find: jest.fn(),
}));

const axios = require('axios');
const WebhookDestination = require('../src/models/WebhookDestination');
const { pingTargets, getTargets } = require('../src/services/renderKeepAliveService');

const mockDestinations = (list) => {
  WebhookDestination.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(list) }) });
};

describe('renderKeepAliveService', () => {
  const originalUrls = process.env.RENDER_KEEP_ALIVE_URLS;

  beforeEach(() => {
    delete process.env.RENDER_KEEP_ALIVE_URLS;
  });

  afterEach(() => {
    if (originalUrls === undefined) delete process.env.RENDER_KEEP_ALIVE_URLS;
    else process.env.RENDER_KEEP_ALIVE_URLS = originalUrls;
    axios.get.mockReset();
    WebhookDestination.find.mockReset();
  });

  it('pings every active destination currently in the WebhookDestination collection', async () => {
    mockDestinations([
      { label: 'Print-Mart', url: 'https://print-mart-dv0h.onrender.com/api/whatsapp/webhook-metabsp' },
      { label: 'Hostel', url: 'https://hostel-dpqg.onrender.com/api/whatsapp/webhook-metabsp' },
      { label: 'MIS', url: 'https://mis-both.onrender.com/webhook/metabsp' },
    ]);
    axios.get.mockResolvedValue({ status: 200 });

    await pingTargets();

    expect(WebhookDestination.find).toHaveBeenCalledWith({ isActive: true });
    expect(axios.get).toHaveBeenCalledTimes(3);
    const urls = axios.get.mock.calls.map((call) => call[0]);
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://print-mart-dv0h.onrender.com/api/whatsapp/webhook-metabsp',
        'https://hostel-dpqg.onrender.com/api/whatsapp/webhook-metabsp',
        'https://mis-both.onrender.com/webhook/metabsp',
      ])
    );
  });

  it('automatically covers a newly added destination with no code change', async () => {
    mockDestinations([
      { label: 'Print-Mart', url: 'https://print-mart-dv0h.onrender.com/api/whatsapp/webhook-metabsp' },
      { label: 'New Project', url: 'https://new-project.onrender.com/webhook' },
    ]);
    axios.get.mockResolvedValue({ status: 200 });

    const targets = await getTargets();

    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: 'https://new-project.onrender.com/webhook' }),
      ])
    );
  });

  it('never throws when a ping fails', async () => {
    mockDestinations([{ label: 'Print-Mart', url: 'https://print-mart-dv0h.onrender.com/api/whatsapp/webhook-metabsp' }]);
    axios.get.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(pingTargets()).resolves.toBeUndefined();
  });

  it('honors a RENDER_KEEP_ALIVE_URLS override instead of querying the database', async () => {
    process.env.RENDER_KEEP_ALIVE_URLS = 'https://example.com/a, https://example.com/b';
    axios.get.mockResolvedValue({ status: 200 });

    await pingTargets();

    expect(WebhookDestination.find).not.toHaveBeenCalled();
    expect(axios.get).toHaveBeenCalledTimes(2);
    const urls = axios.get.mock.calls.map((call) => call[0]);
    expect(urls).toEqual(expect.arrayContaining(['https://example.com/a', 'https://example.com/b']));
  });
});
