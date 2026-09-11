import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import SmbRecord from '@/lib/models/SmbRecord';

const CLOSED = ['completed', 'paid', 'done', 'closed', 'cancelled', 'lost', 'rejected'];
const NOT_CANCELLED = ['cancelled', 'lost', 'rejected'];

function dayBounds(now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  return { start, end };
}
function monthBounds(now = new Date()) {
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}
async function sum(userId: any, match: Record<string, any>, field = 'amountInPaise') {
  const [row] = await SmbRecord.aggregate([{ $match: { userId, ...match } }, { $group: { _id: null, value: { $sum: `$${field}` } } }]);
  return Number(row?.value || 0);
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const userId = authed.doc._id;
    const now = new Date(); const today = dayBounds(now); const month = monthBounds(now);
    const [leadsOpen, followupsDue, followupsOverdue, quotationsOpen, openOrders, tasksDue, tasksOverdue, vendorsActive, productsActive, pendingReviews, salesMonthPaise, collectedMonthPaise, outstandingPaise, expensesMonthPaise] = await Promise.all([
      SmbRecord.countDocuments({ userId, kind: 'lead', status: { $nin: CLOSED } }),
      SmbRecord.countDocuments({ userId, kind: 'followup', status: { $nin: CLOSED }, dueAt: { $lte: today.end } }),
      SmbRecord.countDocuments({ userId, kind: 'followup', status: { $nin: CLOSED }, dueAt: { $lt: today.start } }),
      SmbRecord.countDocuments({ userId, kind: 'quotation', status: { $nin: CLOSED } }),
      SmbRecord.countDocuments({ userId, kind: 'order', status: { $nin: CLOSED } }),
      SmbRecord.countDocuments({ userId, kind: 'task', status: { $nin: CLOSED }, dueAt: { $lte: today.end } }),
      SmbRecord.countDocuments({ userId, kind: 'task', status: { $nin: CLOSED }, dueAt: { $lt: today.start } }),
      SmbRecord.countDocuments({ userId, kind: 'vendor', status: { $nin: ['inactive', 'archived', 'cancelled'] } }),
      SmbRecord.countDocuments({ userId, kind: 'product', status: { $nin: ['inactive', 'archived', 'cancelled'] } }),
      SmbRecord.countDocuments({ userId, kind: 'review_request', status: { $nin: CLOSED } }),
      sum(userId, { kind: 'order', status: { $nin: NOT_CANCELLED }, createdAt: { $gte: month.start, $lt: month.end } }),
      sum(userId, { kind: 'payment', status: { $nin: ['cancelled', 'failed', 'rejected'] }, createdAt: { $gte: month.start, $lt: month.end } }),
      sum(userId, { kind: 'order', status: { $nin: NOT_CANCELLED }, balanceInPaise: { $gt: 0 } }, 'balanceInPaise'),
      sum(userId, { kind: 'expense', status: { $nin: ['cancelled', 'rejected'] }, createdAt: { $gte: month.start, $lt: month.end } }),
    ]);
    const recent = await SmbRecord.find({ userId }).sort({ updatedAt: -1 }).limit(8).populate('contactId', 'name phone category').lean();
    return NextResponse.json({ success: true, data: { leadsOpen, followupsDue, followupsOverdue, quotationsOpen, openOrders, tasksDue, tasksOverdue, vendorsActive, productsActive, pendingReviews, salesMonthPaise, collectedMonthPaise, outstandingPaise, expensesMonthPaise, recent, generatedAt: now.toISOString() } });
  } catch (error) { return errorResponse(error, 'Failed to load small-business summary'); }
}
