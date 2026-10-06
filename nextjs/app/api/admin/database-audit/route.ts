import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { getMongoCollectionCapacity } from '@/lib/services/mongoCollectionCapacity';

const prefixOf = (name: string) => {
  const match = name.match(/^[a-zA-Z_]+/);
  return (match?.[0] || name).slice(0, 64);
};

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    if (!authed.isAdmin) throw new AppError('Admin access required', 403);

    const db: any = mongoose.connection.db;
    if (!db) throw new AppError('MongoDB is not connected', 503);

    const [capacity, collectionsRaw] = await Promise.all([
      getMongoCollectionCapacity(),
      db.listCollections({}, { nameOnly: true }).toArray(),
    ]);

    const collections = collectionsRaw
      .map((item: any) => String(item.name || ''))
      .filter(Boolean)
      .sort();

    const groups = new Map<string, number>();
    for (const name of collections) {
      const prefix = prefixOf(name);
      groups.set(prefix, (groups.get(prefix) || 0) + 1);
    }

    const grouped = Array.from(groups.entries())
      .map(([prefix, count]) => ({ prefix, count }))
      .sort((a, b) => b.count - a.count || a.prefix.localeCompare(b.prefix));

    return NextResponse.json({
      success: true,
      data: {
        cluster: capacity,
        currentDatabase: {
          name: db.databaseName || null,
          count: collections.length,
          groups: grouped.slice(0, 100),
          collections,
        },
        note: 'Cluster capacity is measured with Atlas atlasSize; collection names shown here are only for the current application database. This endpoint is read-only and never deletes anything.',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Mongo collection audit failed');
  }
}
