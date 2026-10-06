import mongoose from 'mongoose';

export const mongoCollectionLimit = () =>
  Math.max(1, Number(process.env.MONGO_COLLECTION_LIMIT || 500));

export async function getMongoCollectionCapacity() {
  const db: any = mongoose.connection.db;
  if (!db) {
    return {
      available: false,
      limit: mongoCollectionLimit(),
      count: null,
      headroom: null,
      overLimit: false,
      atRisk: true,
      ready: false,
    };
  }

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const count = collections.filter((item: any) => String(item?.name || '')).length;
  const limit = mongoCollectionLimit();
  const headroom = limit - count;

  return {
    available: true,
    limit,
    count,
    headroom,
    overLimit: count > limit,
    atRisk: count >= Math.floor(limit * 0.9),
    // Keep at least one slot available. At exactly the provider cap a feature
    // that legitimately needs a new collection would still fail at runtime.
    ready: count < limit,
  };
}
