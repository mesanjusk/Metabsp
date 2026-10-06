import mongoose from 'mongoose';

export const mongoCollectionLimit = () =>
  Math.max(1, Number(process.env.MONGO_COLLECTION_LIMIT || 500));

export async function getMongoCollectionCapacity() {
  const db: any = mongoose.connection.db;
  const limit = mongoCollectionLimit();

  if (!db) {
    return {
      available: false,
      scope: 'cluster',
      source: 'atlasSize',
      limit,
      count: null,
      numDatabases: null,
      headroom: null,
      overLimit: false,
      atRisk: true,
      ready: false,
    };
  }

  try {
    // Atlas Free/Flex exposes atlasSize specifically to report cumulative
    // statistics across *all databases*. Their 500-collection limit is
    // cluster-wide, so counting only mongoose.connection.db is unsafe.
    const result: any = await db.command({ atlasSize: 1 });
    const count = Number(result?.totals?.collections);
    const numDatabases = Number(result?.totals?.numDatabases);

    if (!Number.isFinite(count)) {
      throw new Error('atlasSize did not return totals.collections');
    }

    return {
      available: true,
      scope: 'cluster',
      source: 'atlasSize',
      limit,
      count,
      numDatabases: Number.isFinite(numDatabases) ? numDatabases : null,
      headroom: limit - count,
      overLimit: count > limit,
      atRisk: count >= Math.floor(limit * 0.9),
      ready: count < limit,
    };
  } catch (error: any) {
    // atlasSize is specific to Atlas Free/Flex. If a future deployment moves
    // to a dedicated tier, do not pretend a current-database count proves
    // cluster-wide capacity. Return diagnostic fallback data but keep the
    // launch gate conservative until MONGO_COLLECTION_LIMIT is revisited.
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const currentDatabaseCount = collections.filter((item: any) => String(item?.name || '')).length;

    return {
      available: false,
      scope: 'database_fallback',
      source: 'listCollections',
      limit,
      count: null,
      numDatabases: null,
      headroom: null,
      overLimit: false,
      atRisk: true,
      ready: false,
      currentDatabaseCount,
      reason: String(error?.message || error || 'atlasSize unavailable').slice(0, 500),
    };
  }
}
