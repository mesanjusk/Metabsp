// Runs against a real local Redis instance (this environment happens to
// have one available) rather than mocking BullMQ itself, so this actually
// exercises enqueue -> worker pickup -> retry/backoff -> completion.
const { enqueueBroadcastRecipients, waitForJobResults, closeQueue, getQueue } = require('../src/queues/whatsappSendQueue');
const { startWhatsAppSendWorker } = require('../src/queues/whatsappSendWorker');
const { closeRedisConnection } = require('../src/config/redis');
const { loadAccountContextById } = require('../src/services/whatsappAccountService');
const { dispatchTextMessage, dispatchTemplateMessage } = require('../src/controllers/whatsappController');

jest.mock('../src/services/whatsappAccountService', () => ({
  loadAccountContextById: jest.fn(),
}));

jest.mock('../src/controllers/whatsappController', () => ({
  dispatchTextMessage: jest.fn(),
  dispatchTemplateMessage: jest.fn(),
}));

let worker;

beforeAll(async () => {
  // This queue's Redis state (job-id counter, any leftover completed/failed/
  // delayed-retry jobs) otherwise persists across separate `jest` process
  // runs against the same Redis — obliterate it first so every run starts
  // from a clean queue instead of occasionally picking up stale jobs from a
  // previous run's retry backoff still in flight.
  await getQueue().obliterate({ force: true });
  worker = startWhatsAppSendWorker({ concurrency: 3 });
});

afterAll(async () => {
  await worker.close();
  await closeQueue();
  await closeRedisConnection();
});

beforeEach(() => {
  jest.clearAllMocks();
  loadAccountContextById.mockResolvedValue({ accessToken: 'fake-token', phoneNumberId: '1500000000' });
});

describe('whatsappSendQueue + whatsappSendWorker (live Redis)', () => {
  it('processes a batch of text-message jobs and returns per-recipient success', async () => {
    dispatchTextMessage.mockResolvedValue({ id: 'wamid.fake' });

    const jobs = await enqueueBroadcastRecipients({
      accountId: 'acc-1',
      userId: 'user-1',
      recipients: ['919000000001', '919000000002', '919000000003'],
      messageType: 'text',
      body: 'Hello from the queue',
      campaignId: 'campaign-text-1',
    });

    // Generous window: under a full-suite run (27+ files, ~10-30s total)
    // event-loop/CPU contention can push a normally-sub-second job well
    // past a tight timeout, which previously read as a job "failure" rather
    // than what it actually was — the test's own wait budget being too
    // tight for the machine's current load.
    const results = await waitForJobResults(jobs, { timeoutMs: 30000 });

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);
    expect(dispatchTextMessage).toHaveBeenCalledTimes(3);
    expect(dispatchTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: '919000000001', body: 'Hello from the queue', campaignId: 'campaign-text-1' })
    );
  }, 35000);

  it('routes template jobs to dispatchTemplateMessage, not dispatchTextMessage', async () => {
    dispatchTemplateMessage.mockResolvedValue({ id: 'wamid.template' });

    const jobs = await enqueueBroadcastRecipients({
      accountId: 'acc-1',
      userId: 'user-1',
      recipients: ['919000000004'],
      messageType: 'template',
      templateName: 'order_update',
      language: 'en_US',
      components: [],
      campaignId: 'campaign-template-1',
    });

    // Generous window: under a full-suite run (27+ files, ~10-30s total)
    // event-loop/CPU contention can push a normally-sub-second job well
    // past a tight timeout, which previously read as a job "failure" rather
    // than what it actually was — the test's own wait budget being too
    // tight for the machine's current load.
    const results = await waitForJobResults(jobs, { timeoutMs: 30000 });

    expect(results).toEqual([{ recipient: '919000000004', success: true }]);
    expect(dispatchTemplateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: '919000000004', templateName: 'order_update' })
    );
    expect(dispatchTextMessage).not.toHaveBeenCalled();
  }, 35000);

  it('retries a failing recipient and eventually reports failure with the error message', async () => {
    dispatchTextMessage.mockRejectedValue(new Error('Recipient number is not a valid WhatsApp user'));

    const jobs = await enqueueBroadcastRecipients({
      accountId: 'acc-1',
      userId: 'user-1',
      recipients: ['919000000005'],
      messageType: 'text',
      body: 'This will fail',
      campaignId: 'campaign-fail-1',
    });

    const results = await waitForJobResults(jobs, { timeoutMs: 20000 });

    expect(results).toEqual([
      { recipient: '919000000005', success: false, error: 'Recipient number is not a valid WhatsApp user' },
    ]);
    // 3 attempts total (default job options: attempts: 3), proving the
    // built-in retry/backoff actually ran rather than failing on the first try.
    expect(dispatchTextMessage).toHaveBeenCalledTimes(3);
  }, 25000);

  it('re-resolves the account context per job rather than trusting job data for the token', async () => {
    dispatchTextMessage.mockResolvedValue({ id: 'wamid.fake' });

    const jobs = await enqueueBroadcastRecipients({
      accountId: 'acc-42',
      userId: 'user-1',
      recipients: ['919000000006'],
      messageType: 'text',
      body: 'Security check',
      campaignId: 'campaign-security-1',
    });

    await waitForJobResults(jobs, { timeoutMs: 30000 });

    expect(loadAccountContextById).toHaveBeenCalledWith('acc-42');
  }, 35000);
});
