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

vi.mock('@/lib/db/mongo', () => ({
  connectDB: () => {
    connectCalls.count += 1;
    return connectCalls.reject ? Promise.reject(new Error('unreachable')) : Promise.resolve({});
  },
}));

const { GET } = await import('@/app/api/health/route');

const call = (url: string) => GET({ nextUrl: new URL(url) } as any);

describe('health probe', () => {
  beforeEach(() => {
    readyState.value = 1;
    connectCalls.count = 0;
    connectCalls.reject = false;
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

  it('reports 200 in strict mode once the database is reachable', async () => {
    const response = await call('https://example.test/api/health?strict=1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, dbReady: true });
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
});
