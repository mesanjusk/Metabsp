import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * A failed connection attempt must never be cached.
 *
 * connectDB() memoises its connect promise on `global` so that warm
 * invocations and dev-mode hot reloads reuse one pool. It used to cache the
 * promise unconditionally, which meant a REJECTED one stayed cached too: the
 * first failure became permanent, mongoose.connect() was never called again,
 * and every database-backed route answered 503 "Service temporarily
 * unavailable. Please retry." until the process restarted — while
 * /api/health, which does not await the connect, kept the instance alive and
 * in rotation.
 *
 * Sign-up and sign-in were where users met it: both guard connectDB() and
 * both returned that identical 503 on every attempt, so retrying as the
 * message instructed could not possibly help. These tests pin the eviction.
 */

vi.unmock('@/lib/db/mongo');

const connect = vi.hoisted(() => ({ calls: 0, fail: true, uris: [] as string[] }));

vi.mock('mongoose', () => ({
  default: {
    connect: (uri: string) => {
      connect.calls += 1;
      connect.uris.push(uri);
      return connect.fail
        ? Promise.reject(new Error('server selection timed out'))
        : Promise.resolve({ connection: { readyState: 1 } });
    },
  },
}));

const importFresh = async () => {
  vi.resetModules();
  return (await import('@/lib/db/mongo')).connectDB;
};

describe('connectDB connection caching', () => {
  beforeEach(() => {
    connect.calls = 0;
    connect.fail = true;
    connect.uris = [];
    global.__metabspMongoosePromise = undefined;
    process.env.MONGO_URI = 'mongodb://db.example/metabsp';
  });

  it('retries on the next call after a failed attempt instead of replaying it', async () => {
    const connectDB = await importFresh();

    await expect(connectDB()).rejects.toThrow('server selection timed out');
    expect(connect.calls).toBe(1);
    // The dead promise must not still be sitting on `global`.
    expect(global.__metabspMongoosePromise).toBeUndefined();

    // The database is reachable again — the very next caller must get through.
    connect.fail = false;
    await expect(connectDB()).resolves.toEqual({ connection: { readyState: 1 } });
    expect(connect.calls).toBe(2);
  });

  it('keeps retrying for as long as the database is unreachable', async () => {
    const connectDB = await importFresh();

    for (let i = 1; i <= 3; i += 1) {
      await expect(connectDB()).rejects.toThrow('server selection timed out');
      expect(connect.calls).toBe(i);
    }
  });

  it('caches a successful connection so the pool is opened exactly once', async () => {
    connect.fail = false;
    const connectDB = await importFresh();

    await expect(connectDB()).resolves.toBeTruthy();
    await expect(connectDB()).resolves.toBeTruthy();
    await expect(connectDB()).resolves.toBeTruthy();

    expect(connect.calls).toBe(1);
  });

  it('shares one in-flight attempt between concurrent callers', async () => {
    connect.fail = false;
    const connectDB = await importFresh();

    await Promise.all([connectDB(), connectDB(), connectDB()]);

    expect(connect.calls).toBe(1);
  });

  it('does not evict a live connection when a stale failure settles late', async () => {
    const connectDB = await importFresh();

    // First attempt fails and clears the cache.
    await expect(connectDB()).rejects.toThrow();

    // A later attempt succeeds and is cached.
    connect.fail = false;
    await connectDB();
    const cached = global.__metabspMongoosePromise;
    expect(cached).toBeDefined();

    // The identity guard in the catch means the earlier failure cannot come
    // back and null out the connection that replaced it.
    await connectDB();
    expect(global.__metabspMongoosePromise).toBe(cached);
    expect(connect.calls).toBe(2);
  });

  it('rejects without caching anything when MONGO_URI is unset', async () => {
    delete process.env.MONGO_URI;
    const connectDB = await importFresh();

    await expect(connectDB()).rejects.toThrow('MONGO_URI is not set');
    expect(global.__metabspMongoosePromise).toBeUndefined();
    expect(connect.calls).toBe(0);
  });
});
