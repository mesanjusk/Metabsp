import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * The regression this file exists for: the boot self-check ran its two probes
 * through one `Promise.all`, and ioredis does not reject against a host that
 * does not resolve — it retries forever. So a deployment pointed at the wrong
 * `REDIS_URL` produced no self-check output at all, including the line that
 * says whether `WHATSAPP_TOKEN_ENCRYPTION_KEY` can still read the tokens
 * already in the database.
 *
 * That is the pairing that matters: a migration that gets `REDIS_URL` wrong is
 * a migration that can just as easily have got the encryption key wrong, and
 * the encryption key is the one whose failure is otherwise silent until every
 * customer's sends start failing. The Redis probe must never be able to
 * suppress it.
 */

const config = vi.fn();
vi.mock('@/lib/db/redis', () => ({ getRedisConnection: () => ({ config }) }));

const lean = vi.fn();
vi.mock('@/lib/models/WhatsAppAccount', () => ({
  default: { find: () => ({ select: () => ({ limit: () => ({ lean }) }) }) },
}));

vi.mock('@/lib/utils/crypto', () => ({
  decryptSensitiveValue: (value: string) => {
    if (value === 'undecryptable') throw new Error('unsupported state or unable to authenticate data');
    return 'plaintext-token';
  },
}));

const info = vi.fn();
const warn = vi.fn();
const error = vi.fn();
vi.mock('@/lib/utils/logger', () => ({
  default: { info, warn, error, debug: vi.fn() },
}));

const { runBootSelfCheck } = await import('@/lib/services/bootSelfCheck');

/** Every line the run logged, whatever its level. */
function loggedLines(): string[] {
  return [...info.mock.calls, ...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]));
}

/** Drives the run to completion, pushing past the Redis probe's timeout. */
async function runPastRedisTimeout(): Promise<void> {
  const done = runBootSelfCheck();
  await vi.advanceTimersByTimeAsync(6_000);
  await done;
}

beforeEach(() => {
  vi.useFakeTimers();
  info.mockClear();
  warn.mockClear();
  error.mockClear();
  config.mockClear();
  lean.mockClear();
  lean.mockImplementation(async () => [{ _id: '1', accessTokenEncrypted: 'cipher' }]);
  config.mockImplementation(async () => ['maxmemory-policy', 'noeviction']);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('boot self-check', () => {
  it('still reports the encryption key when Redis never answers', async () => {
    // Exactly what an unreachable instance looks like from ioredis: no
    // resolution, no rejection, just a promise that never settles.
    config.mockImplementation(() => new Promise<never>(() => {}));

    await runPastRedisTimeout();

    expect(loggedLines()).toContainEqual(
      expect.stringContaining('Token encryption key verified against 1 stored account(s)')
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not verify the Redis eviction policy'));
  });

  it('still reports an unreadable encryption key when Redis never answers', async () => {
    config.mockImplementation(() => new Promise<never>(() => {}));
    lean.mockImplementation(async () => [{ _id: '1', accessTokenEncrypted: 'undecryptable' }]);

    await runPastRedisTimeout();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL: WHATSAPP_TOKEN_ENCRYPTION_KEY cannot decrypt')
    );
  });

  it('reports both checks when Redis answers', async () => {
    await runPastRedisTimeout();

    expect(info).toHaveBeenCalledWith(expect.stringContaining('Token encryption key verified against 1'));
    expect(info).toHaveBeenCalledWith(expect.stringContaining('Redis eviction policy is noeviction'));
  });

  it('calls an evicting policy what it is', async () => {
    config.mockImplementation(async () => ['maxmemory-policy', 'allkeys-lru']);

    await runPastRedisTimeout();

    expect(error).toHaveBeenCalledWith(expect.stringContaining('"allkeys-lru", not "noeviction"'));
  });

  it('reports a blocked CONFIG GET as unverified rather than a pass', async () => {
    // Render blocks CONFIG GET outright; that is not a failure, but reporting
    // it as a pass would claim queued messages are safe when nobody checked.
    config.mockImplementation(async () => {
      throw new Error("NOPERM User default has no permissions to run the 'config|get' command");
    });

    await runPastRedisTimeout();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not verify the Redis eviction policy'));
    expect(loggedLines()).not.toContainEqual(expect.stringContaining('Redis eviction policy is noeviction'));
  });

  it('does not claim a key is verified when there is nothing to verify against', async () => {
    lean.mockImplementation(async () => []);

    await runPastRedisTimeout();

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('Token encryption key not verified — No connected accounts to sample')
    );
  });
});
