import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import Contact from '@/lib/models/Contact';
import SmbRecord from '@/lib/models/SmbRecord';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';

const CLOSED = ['completed', 'paid', 'done', 'closed', 'cancelled', 'lost', 'rejected'];

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const userId = authed.doc._id;
    const today = startOfToday();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      customers,
      newCustomers7d,
      followupsDue,
      suppliers,
      purchaseOrdersOpen,
      tasksOverdue,
      responsibilities,
      whatsappAccounts,
    ] = await Promise.all([
      Contact.countDocuments({ userId }),
      Contact.countDocuments({ userId, createdAt: { $gte: weekAgo } }),
      SmbRecord.countDocuments({
        userId,
        kind: 'followup',
        status: { $nin: CLOSED },
        dueAt: { $lte: new Date() },
      }),
      SmbRecord.countDocuments({
        userId,
        kind: 'vendor',
        status: { $nin: ['inactive', 'archived', 'cancelled'] },
      }),
      SmbRecord.countDocuments({
        userId,
        kind: 'purchase_order',
        status: { $nin: CLOSED },
      }),
      SmbRecord.countDocuments({
        userId,
        kind: 'task',
        status: { $nin: CLOSED },
        dueAt: { $lt: today },
      }),
      SmbRecord.countDocuments({
        userId,
        kind: 'responsibility',
        status: { $nin: ['inactive', 'archived', 'cancelled'] },
      }),
      WhatsAppAccount.find({ userId }).select('teamMemberIds').lean(),
    ]);

    const teamMemberIds = new Set<string>();
    for (const account of whatsappAccounts as any[]) {
      for (const memberId of account?.teamMemberIds || []) teamMemberIds.add(String(memberId));
    }

    return NextResponse.json({
      success: true,
      data: {
        customers,
        newCustomers7d,
        followupsDue,
        suppliers,
        purchaseOrdersOpen,
        teamMembers: teamMemberIds.size,
        tasksOverdue,
        responsibilities,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load founder overview');
  }
}
