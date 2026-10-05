import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import DataDeletionRequest from '@/lib/models/DataDeletionRequest';
import { errorResponse } from '@/lib/http/errorResponse';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const rows = await DataDeletionRequest.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .select('confirmationCode requestType requesterEmail accountId reason notes status provider createdAt completedAt')
      .lean();

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return errorResponse(error, 'Failed to load privacy deletion requests');
  }
}
