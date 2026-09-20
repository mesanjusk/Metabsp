import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { requireServiceAccess } from '@/lib/services/serviceAccess';
import { syncAllStoreProductsForOwner } from '@/lib/store/syncProductToSmb';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    await requireServiceAccess(authed, 'store');

    const result = await syncAllStoreProductsForOwner(authed.doc._id);
    return NextResponse.json({
      success: result.failures.length === 0,
      data: result,
    });
  } catch (error) {
    return errorResponse(error, 'Failed to synchronize store products');
  }
}
