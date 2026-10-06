#!/usr/bin/env node
/**
 * Read-only Mongo collection-cap audit.
 *
 * It never drops or alters collections. Use this before any cleanup so legacy
 * candidates can be reviewed explicitly.
 */
import mongoose from 'mongoose';

const uri = String(process.env.MONGO_URI || '').trim();
const limit = Math.max(1, Number(process.env.MONGO_COLLECTION_LIMIT || 500));

if (!uri) {
  console.error('MONGO_URI is required');
  process.exit(2);
}

const prefixOf = (name) => {
  const match = name.match(/^[a-zA-Z_]+/);
  return (match?.[0] || name).slice(0, 64);
};

let conn;
try {
  conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: false,
  });
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection has no database handle');

  const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((item) => String(item.name || ''))
    .filter(Boolean)
    .sort();

  const groups = new Map();
  for (const name of collections) {
    const prefix = prefixOf(name);
    groups.set(prefix, (groups.get(prefix) || 0) + 1);
  }

  const grouped = Array.from(groups.entries())
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count || a.prefix.localeCompare(b.prefix));

  const result = {
    count: collections.length,
    limit,
    headroom: limit - collections.length,
    overLimit: collections.length > limit,
    atRisk: collections.length >= Math.floor(limit * 0.9),
    groups: grouped,
    collections,
  };

  console.log(JSON.stringify(result, null, 2));
  if (result.count >= limit) {
    console.error(
      `Mongo collection capacity is exhausted (${result.count}/${limit}). Review names above before deleting anything.`
    );
    process.exitCode = 1;
  }
} finally {
  await conn?.disconnect?.().catch(() => undefined);
}
