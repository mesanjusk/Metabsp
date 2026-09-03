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
const ping = vi.fn();
vi.mock('@/lib/db/redis', () => ({ getRedisConnection: () => ({ config, ping }) }));

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

/**
 * Drives the run to completion, pushing past both Redis probes' timeouts.
 * PING and CONFIG are bounded separately and run in sequence, so one timeout's
 * worth of fake time is no longer enough to finish the run.
 */
async function runPastRedisTimeout(): Promise<void> {
  const done = runBootSelfCheck();
  await vi.advanceTimersByTimeAsync(12_000);
  await done;
}

beforeEach(() => {
  vi.useFakeTimers();
  info.mockClear();
  warn.mockClear();
  error.mockClear();
  config.mockClear();
  ping.mockClear();
  lean.mockClear();
  ping.mockImplementation(async () => 'PONG');
  lean.mockImplementation(async () => [{ _id: '1', accessTokenEncrypted: 'cipher' }]);
  config.mockImplementation(async () => ['maxmemory-policy', 'noeviction']);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('boot self-check', () => {
  it('still reports the encryption key when Redis never answers', async () => {
    // Exactly what an unreachable instance looks like from ioredis: no
    // resolution, no rejection, just a promise that never settles. It has to
    // be PING that hangs — a CONFIG that hangs behind a PONG is a provider
    // hiding CONFIG, which is a different thing entirely.
    ping.mockImplementation(() => new Promise<never>(() => {}));

    await runPastRedisTimeout();

    expect(loggedLines()).toContainEqual(
      expect.stringContaining('Token encryption key verified against 1 stored account(s)')
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Redis did not answer PING'));
  });

  it('still reports an unreadable encryption key when Redis never answers', async () => {
    ping.mockImplementation(() => new Promise<never>(() => {}));
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

    expect(info).toHaveBeenCalledWith(expect.stringContaining('blocks CONFIG GET, which is normal'));
    expect(loggedLines()).not.toContainEqual(expect.stringContaining('Redis eviction policy is noeviction'));
  });

  it('does not warn every boot about a provider that will never allow the check', async () => {
    // The condition is permanent and actionable exactly once. Warned at every
    // boot, it is what teaches an operator to skim past the self-check —
    // which is how the far louder finding below went unread.
    config.mockImplementation(async () => {
      throw new Error("NOPERM User default has no permissions to run the 'config|get' command");
    });

    await runPastRedisTimeout();

    expect(warn).not.toHaveBeenCalled();
  });

  it('separates an unreachable Redis from a policy it merely cannot read', async () => {
    // These shared one message before, so an instance that answered nothing
    // read as a provider quirk. It is the more serious of the two: while it
    // holds, nothing drains the webhook queue.
    ping.mockImplementation(() => new Promise<never>(() => {}));

    await runPastRedisTimeout();

    const lines = loggedLines();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Redis did not answer PING'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('queued sends do not drain'));
    // The old message blamed the eviction policy for a reachability failure.
    expect(lines).not.toContainEqual(expect.stringContaining('Could not verify the Redis eviction policy'));
  });

  it('does not call a live Redis unreachable because CONFIG went unanswered', async () => {
    // The bug this rewrite is for, seen in production: Render hides CONFIG by
    // not answering it rather than by refusing it, and ioredis is built here
    // with maxRetriesPerRequest:null, so the command is buffered rather than
    // rejected and never settles. The old check read that timeout as an
    // outage and told an operator to check a REDIS_URL that was correct,
    // while webhooks were queueing through the same connection perfectly.
    config.mockImplementation(() => new Promise<never>(() => {}));

    await runPastRedisTimeout();

    expect(info).toHaveBeenCalledWith(expect.stringContaining('blocks CONFIG GET, which is normal'));
    expect(warn).not.toHaveBeenCalled();
  });

  it('asks PING before it asks anything a provider is allowed to refuse', async () => {
    await runPastRedisTimeout();

    expect(ping).toHaveBeenCalled();
    expect(ping.mock.invocationCallOrder[0]).toBeLessThan(config.mock.invocationCallOrder[0]);
  });

  it('treats an answer that is not PONG as unreachable', async () => {
    // A proxy or a wrong port can accept the connection and answer something
    // else. Reading any response as success would be worse than the timeout.
    ping.mockImplementation(async () => 'no');

    await runPastRedisTimeout();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Redis did not answer PING'));
  });

  it('names what PING actually said, rather than only that it failed', async () => {
    ping.mockImplementation(async () => {
      throw new Error('getaddrinfo ENOTFOUND red-old-instance');
    });

    await runPastRedisTimeout();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ENOTFOUND red-old-instance'));
  });

  it('does not claim a key is verified when there is nothing to verify against', async () => {
    lean.mockImplementation(async () => []);

    await runPastRedisTimeout();

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('Token encryption key not verified — No connected accounts to sample')
    );
  });
});
