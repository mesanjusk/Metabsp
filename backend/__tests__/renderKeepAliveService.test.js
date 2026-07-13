jest.mock('axios');
const axios = require('axios');
const { pingTargets } = require('../src/services/renderKeepAliveService');

describe('renderKeepAliveService', () => {
  const originalUrls = process.env.RENDER_KEEP_ALIVE_URLS;

  afterEach(() => {
    if (originalUrls === undefined) delete process.env.RENDER_KEEP_ALIVE_URLS;
    else process.env.RENDER_KEEP_ALIVE_URLS = originalUrls;
    axios.get.mockReset();
  });

  it('pings all three default sibling services', async () => {
    delete process.env.RENDER_KEEP_ALIVE_URLS;
    axios.get.mockResolvedValue({ status: 200 });

    await pingTargets();

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

  it('never throws when a ping fails', async () => {
    delete process.env.RENDER_KEEP_ALIVE_URLS;
    axios.get.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(pingTargets()).resolves.toBeUndefined();
  });

  it('honors a RENDER_KEEP_ALIVE_URLS override instead of the defaults', async () => {
    process.env.RENDER_KEEP_ALIVE_URLS = 'https://example.com/a, https://example.com/b';
    axios.get.mockResolvedValue({ status: 200 });

    await pingTargets();

    expect(axios.get).toHaveBeenCalledTimes(2);
    const urls = axios.get.mock.calls.map((call) => call[0]);
    expect(urls).toEqual(expect.arrayContaining(['https://example.com/a', 'https://example.com/b']));
  });
});
