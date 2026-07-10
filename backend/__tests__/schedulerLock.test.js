const mockSet = jest.fn();

jest.mock('../src/config/redis', () => ({
  getRedisConnection: () => ({ set: (...args) => mockSet(...args) }),
}));

const { withLeaderLock } = require('../src/services/schedulerLock');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('withLeaderLock', () => {
  it('runs the task when the lock is acquired', async () => {
    mockSet.mockResolvedValue('OK');
    const fn = jest.fn().mockResolvedValue('done');

    const result = await withLeaderLock('token-refresh', fn);

    expect(mockSet).toHaveBeenCalledWith(
      'scheduler-lock:token-refresh',
      expect.any(String),
      'PX',
      5 * 60 * 1000,
      'NX'
    );
    expect(fn).toHaveBeenCalled();
    expect(result).toBe('done');
  });

  it('skips the task when another replica already holds the lock', async () => {
    mockSet.mockResolvedValue(null);
    const fn = jest.fn();

    const result = await withLeaderLock('invoice-generation', fn);

    expect(fn).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('respects a custom ttlMs', async () => {
    mockSet.mockResolvedValue('OK');
    const fn = jest.fn().mockResolvedValue(undefined);

    await withLeaderLock('scheduled-backup', fn, { ttlMs: 20 * 60 * 1000 });

    expect(mockSet).toHaveBeenCalledWith(
      'scheduler-lock:scheduled-backup',
      expect.any(String),
      'PX',
      20 * 60 * 1000,
      'NX'
    );
  });

  it('fails open (runs the task) if the lock check itself errors', async () => {
    mockSet.mockRejectedValue(new Error('redis unreachable'));
    const fn = jest.fn().mockResolvedValue('ran anyway');

    const result = await withLeaderLock('token-refresh', fn);

    expect(fn).toHaveBeenCalled();
    expect(result).toBe('ran anyway');
  });
});
