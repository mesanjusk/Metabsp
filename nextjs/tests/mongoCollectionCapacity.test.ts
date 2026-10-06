import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  atlasSize: { totals: { collections: 120, numDatabases: 4 } } as any,
  atlasError: null as Error | null,
  currentCollections: ['users', 'messages'],
}));

vi.mock('mongoose', () => ({
  default: {
    connection: {
      db: {
        command: async () => {
          if (state.atlasError) throw state.atlasError;
          return state.atlasSize;
        },
        listCollections: () => ({
          toArray: async () => state.currentCollections.map((name) => ({ name })),
        }),
      },
    },
  },
}));

const { getMongoCollectionCapacity } = await import('@/lib/services/mongoCollectionCapacity');

describe('Mongo Atlas collection capacity', () => {
  beforeEach(() => {
    state.atlasSize = { totals: { collections: 120, numDatabases: 4 } };
    state.atlasError = null;
    state.currentCollections = ['users', 'messages'];
    vi.stubEnv('MONGO_COLLECTION_LIMIT', '500');
  });

  it('uses atlasSize cluster totals instead of current-database collection count', async () => {
    state.atlasSize = { totals: { collections: 511, numDatabases: 19 } };
    state.currentCollections = Array.from({ length: 68 }, (_, i) => `app_${i}`);

    await expect(getMongoCollectionCapacity()).resolves.toMatchObject({
      available: true,
      scope: 'cluster',
      source: 'atlasSize',
      count: 511,
      numDatabases: 19,
      limit: 500,
      headroom: -11,
      overLimit: true,
      ready: false,
    });
  });

  it('keeps the launch gate conservative if atlasSize is unavailable', async () => {
    state.atlasError = new Error('command atlasSize is not supported');
    state.currentCollections = ['one', 'two', 'three'];

    await expect(getMongoCollectionCapacity()).resolves.toMatchObject({
      available: false,
      scope: 'database_fallback',
      source: 'listCollections',
      count: null,
      currentDatabaseCount: 3,
      ready: false,
    });
  });

  it('reports ready only while cluster-wide count remains below the configured limit', async () => {
    state.atlasSize = { totals: { collections: 499, numDatabases: 10 } };
    await expect(getMongoCollectionCapacity()).resolves.toMatchObject({
      count: 499,
      headroom: 1,
      ready: true,
    });

    state.atlasSize = { totals: { collections: 500, numDatabases: 10 } };
    await expect(getMongoCollectionCapacity()).resolves.toMatchObject({
      count: 500,
      headroom: 0,
      ready: false,
    });
  });
});
