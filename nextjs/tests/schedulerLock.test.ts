import { describe, expect, it, vi, beforeEach } from 'vitest';

const set = vi.fn();
vi.mock('@/lib/db/redis', () => ({ getRedisConnection: () => ({ set }) }));

const { withLeaderLock } = await import('@/lib/services/schedulerLock');

/**
 * Each test sets an explicit implementation, and beforeEach clears calls
 * rather than calling mockReset(). Under Vitest 3, mockReset() after a
 * mockResolvedValue() leaves the eagerly-created promise behind, and the next
 * test's rejection surfaces as an unhandled one attributed to whichever test
 * happens to be running — a failure that has nothing to do with the code.
 */
beforeEach(() => {
  set.mockClear();
  set.mockImplementation(async () => undefined);
});

describe('scheduler leader lock', () => {
  it('runs the task on the replica that wins the lock', async () => {
    set.mockImplementation(async () => 'OK');
    const task = vi.fn(async () => 'ran');

    expect(await withLeaderLock('invoice-generation', task)).toBe('ran');
    expect(task).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(
      'scheduler-lock:invoice-generation',
      expect.any(String),
      'PX',
      expect.any(Number),
      'NX'
    );
  });

  it('skips the task on a replica that loses the race — duplicate billing is the risk', async () => {
    set.mockImplementation(async () => null);
    const task = vi.fn();

    expect(await withLeaderLock('invoice-generation', task)).toBeUndefined();
    expect(task).not.toHaveBeenCalled();
  });

  it('fails open when Redis is unreachable, so scheduled work still happens', async () => {
    set.mockImplementation(async () => {
      throw new Error('redis down');
    });
    const task = vi.fn(async () => 'ran anyway');

    expect(await withLeaderLock('token-refresh', task)).toBe('ran anyway');
    expect(task).toHaveBeenCalledOnce();
  });

  it('honours a caller-supplied TTL for a long-running task', async () => {
    set.mockImplementation(async () => 'OK');
    await withLeaderLock('scheduled-backup', async () => null, { ttlMs: 20 * 60 * 1000 });

    expect(set).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'PX', 20 * 60 * 1000, 'NX');
  });

  it('uses a distinct lock key per task, so two schedulers never block each other', async () => {
    set.mockImplementation(async () => 'OK');
    await withLeaderLock('token-refresh', async () => null);
    await withLeaderLock('invoice-generation', async () => null);

    const keys = set.mock.calls.map((call) => call[0]);
    expect(new Set(keys).size).toBe(2);
  });
});
