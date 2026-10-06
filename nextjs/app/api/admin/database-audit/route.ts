import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';

const ATLAS_COLLECTION_LIMIT = Math.max(1, Number(process.env.MONGO_COLLECTION_LIMIT || 500));

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

    const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
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
        limit: ATLAS_COLLECTION_LIMIT,
        count: collections.length,
        headroom: ATLAS_COLLECTION_LIMIT - collections.length,
        overLimit: collections.length > ATLAS_COLLECTION_LIMIT,
        atRisk: collections.length >= Math.floor(ATLAS_COLLECTION_LIMIT * 0.9),
        groups: grouped.slice(0, 100),
        collections,
        note: 'This endpoint is read-only. No collection is ever deleted automatically.',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Mongo collection audit failed');
  }
}
