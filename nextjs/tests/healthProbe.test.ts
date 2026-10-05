import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * The rollout gate must not be hostage to a dependency.
 *
 * On 2026-09-15 three consecutive Render deploys failed while the incumbent
 * instance kept serving, because /api/health answered 503 whenever MongoDB was
 * unreachable and Render uses it to decide whether a new instance may take
 * over. The version being "protected" could not reach the database either, so
 * the gate preserved nothing and blocked the fix. These tests pin the split:
 * liveness by default, readiness only when asked.
 */

const readyState = vi.hoisted(() => ({ value: 1 }));

vi.mock('mongoose', () => ({
  default: {
    get connection() {
      return { get readyState() { return readyState.value; } };
    },
  },
}));

const connectCalls = vi.hoisted(() => ({ count: 0, reject: false }));
const redisState = vi.hoisted(() => ({ reachable: true }));

vi.mock('@/lib/db/mongo', () => ({
  connectDB: () => {
    connectCalls.count += 1;
    return connectCalls.reject ? Promise.reject(new Error('unreachable')) : Promise.resolve({});
  },
}));

vi.mock('@/lib/db/redis', () => ({
  getRedisConnection: () => ({
    ping: async () => {
      if (!redisState.reachable) throw new Error('redis unavailable');
      return 'PONG';
    },
  }),
}));

const backupState = vi.hoisted(() => ({ ok: true, ageHours: 1 }));
const durableQueueState = vi.hoisted(() => ({ recoverable: 0 }));

vi.mock('@/lib/services/encryptedBackupService', () => ({
  hasRecentSuccessfulBackup: async () => ({
    ok: backupState.ok,
    latest: backupState.ok ? { completedAt: new Date() } : null,
    ageHours: backupState.ageHours,
  }),
}));

vi.mock('@/lib/models/DurableQueueJob', () => ({
  default: {
    countDocuments: async () => durableQueueState.recoverable,
  },
}));

const { GET } = await import('@/app/api/health/route');

const call = (url: string) => GET({ nextUrl: new URL(url) } as any);

describe('health probe', () => {
  beforeEach(() => {
    readyState.value = 1;
    connectCalls.count = 0;
    connectCalls.reject = false;
    redisState.reachable = true;
    backupState.ok = true;
    backupState.ageHours = 1;
    durableQueueState.recoverable = 0;
    vi.stubEnv('ENABLE_SCHEDULED_BACKUPS', 'false');
    vi.stubEnv('BACKUP_ENCRYPTION_KEY', '');
    vi.stubEnv('MONGO_URI', 'mongodb://ci-health');
    vi.stubEnv('REDIS_URL', 'redis://ci-health');
    vi.stubEnv('JWT_SECRET', 'ci-health-value');
    vi.stubEnv('WHATSAPP_TOKEN_ENCRYPTION_KEY', 'ci-health-key');
  });

  it('reports 200 with the database connected', async () => {
    const response = await call('https://example.test/api/health');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, alive: true, db: 'connected', dbReady: true });
  });

  it('still reports 200 with the database down, so a rollout is not blocked', async () => {
    readyState.value = 0;
    const response = await call('https://example.test/api/health');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ alive: true, db: 'disconnected', dbReady: false });
  });

  it('reports 503 in strict mode when the database is down, for uptime alerting', async () => {
    readyState.value = 0;
    const response = await call('https://example.test/api/health?strict=1');
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, dbReady: false });
  });

  it('reports 200 in strict mode once Mongo, Redis and critical config are ready', async () => {
    const response = await call('https://example.test/api/health?strict=1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      dbReady: true,
      redisReady: true,
      configReady: true,
    });
  });

  it('reports 503 in strict mode when Redis is unavailable', async () => {
    redisState.reachable = false;
    const response = await call('https://example.test/api/health?strict=1');
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      dbReady: true,
      redisReady: false,
    });
  });

  it('reports 503 in strict mode when critical configuration is missing', async () => {
    vi.stubEnv('JWT_SECRET', '');
    const response = await call('https://example.test/api/health?strict=1');
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, configReady: false });
  });

  /**
   * Awaiting the connection was the second half of the outage: connectDB only
   * rejects after the server-selection timeout, so the check hung for that
   * whole window and Render recorded a timeout rather than a 503 — an
   * unreachable database presenting as an unresponsive app.
   */
  it('never waits on the connection, even when it is failing', async () => {
    readyState.value = 0;
    connectCalls.reject = true;
    const response = await call('https://example.test/api/health');
    expect(response.status).toBe(200);
    // The connect is kicked off so a cold instance starts dialling...
    expect(connectCalls.count).toBe(1);
    // ...and its rejection must not surface as an unhandled rejection.
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('distinguishes a connection still being established from a dead one', async () => {
    readyState.value = 2;
    await expect((await call('https://example.test/api/health')).json()).resolves.toMatchObject({
      db: 'connecting',
      dbReady: false,
    });
  });

  it('reports a stale enabled backup as not ready in strict monitoring mode', async () => {
    vi.stubEnv('ENABLE_SCHEDULED_BACKUPS', 'true');
    vi.stubEnv('BACKUP_ENCRYPTION_KEY', 'Y2ktYnVpbGQtb25seS0zMi1ieXRlLWtleS0xMjM0NQ==');
    backupState.ok = false;
    backupState.ageHours = 40;

    const response = await call('https://example.test/api/health?strict=1');
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      backupReady: false,
      backupAgeHours: 40,
    });
  });

  it('surfaces stale durable queue work for monitoring without breaking liveness', async () => {
    durableQueueState.recoverable = 7;
    const response = await call('https://example.test/api/health?strict=1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      durableQueueRecoverable: 7,
    });
  });
});
