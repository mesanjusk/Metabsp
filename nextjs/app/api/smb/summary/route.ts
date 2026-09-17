import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import SmbRecord from '@/lib/models/SmbRecord';
import { getAccessibleSmbKinds } from '@/lib/services/smbAccess';

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
function daysAgo(now: Date, days: number) {
  const value = new Date(now);
  value.setDate(value.getDate() - days);
  return value;
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
    const { allowed } = await getAccessibleSmbKinds(authed);
    const canStaff = allowed.has('task');
    const canPayments = allowed.has('payment');
    const canMarketing = allowed.has('social_content');
    const now = new Date();
    const today = dayBounds(now);
    const month = monthBounds(now);
    const d30 = daysAgo(now, 30);
    const d60 = daysAgo(now, 60);
    const d90 = daysAgo(now, 90);

    const [
      leadsOpen, followupsDue, followupsOverdue, quotationsOpen, openOrders, deliveriesOpen,
      tasksDue, tasksOverdue, sopsActive, responsibilitiesActive, vendorsActive, productsActive,
      pendingReviews, paymentRemindersOpen, purchaseOrdersOpen, rateCardsActive,
      socialContentCount, socialApprovalsOpen, socialScheduledOpen,
      salesMonthPaise, collectedMonthPaise, outstandingPaise, expensesMonthPaise,
      agingCurrentPaise, aging30Paise, aging60Paise, aging90PlusPaise,
    ] = await Promise.all([
      SmbRecord.countDocuments({ userId, kind: 'lead', status: { $nin: CLOSED } }),
      SmbRecord.countDocuments({ userId, kind: 'followup', status: { $nin: CLOSED }, dueAt: { $lte: today.end } }),
      SmbRecord.countDocuments({ userId, kind: 'followup', status: { $nin: CLOSED }, dueAt: { $lt: today.start } }),
      SmbRecord.countDocuments({ userId, kind: 'quotation', status: { $nin: CLOSED } }),
      SmbRecord.countDocuments({ userId, kind: 'order', status: { $nin: CLOSED } }),
      SmbRecord.countDocuments({ userId, kind: 'delivery', status: { $nin: CLOSED } }),
      canStaff ? SmbRecord.countDocuments({ userId, kind: 'task', status: { $nin: CLOSED }, dueAt: { $lte: today.end } }) : Promise.resolve(0),
      canStaff ? SmbRecord.countDocuments({ userId, kind: 'task', status: { $nin: CLOSED }, dueAt: { $lt: today.start } }) : Promise.resolve(0),
      canStaff ? SmbRecord.countDocuments({ userId, kind: 'sop_task', status: { $nin: ['inactive', 'archived', 'cancelled'] } }) : Promise.resolve(0),
      canStaff ? SmbRecord.countDocuments({ userId, kind: 'responsibility', status: { $nin: ['inactive', 'archived', 'cancelled'] } }) : Promise.resolve(0),
      canStaff ? SmbRecord.countDocuments({ userId, kind: 'vendor', status: { $nin: ['inactive', 'archived', 'cancelled'] } }) : Promise.resolve(0),
      SmbRecord.countDocuments({ userId, kind: 'product', status: { $nin: ['inactive', 'archived', 'cancelled'] } }),
      SmbRecord.countDocuments({ userId, kind: 'review_request', status: { $nin: CLOSED } }),
      canPayments ? SmbRecord.countDocuments({ userId, kind: 'payment_reminder', status: { $nin: CLOSED } }) : Promise.resolve(0),
      canPayments ? SmbRecord.countDocuments({ userId, kind: 'purchase_order', status: { $nin: CLOSED } }) : Promise.resolve(0),
      canPayments ? SmbRecord.countDocuments({ userId, kind: 'rate_card', status: { $nin: ['inactive', 'archived', 'cancelled'] } }) : Promise.resolve(0),
      canMarketing ? SmbRecord.countDocuments({ userId, kind: 'social_content', status: { $nin: ['archived', 'cancelled'] } }) : Promise.resolve(0),
      canMarketing ? SmbRecord.countDocuments({ userId, kind: 'social_approval', status: { $nin: CLOSED } }) : Promise.resolve(0),
      canMarketing ? SmbRecord.countDocuments({ userId, kind: 'social_schedule', status: { $nin: CLOSED } }) : Promise.resolve(0),
      sum(userId, { kind: 'order', status: { $nin: NOT_CANCELLED }, createdAt: { $gte: month.start, $lt: month.end } }),
      canPayments ? sum(userId, { kind: 'payment', status: { $nin: ['cancelled', 'failed', 'rejected'] }, createdAt: { $gte: month.start, $lt: month.end } }) : Promise.resolve(0),
      canPayments ? sum(userId, { kind: { $in: ['order', 'invoice'] }, status: { $nin: NOT_CANCELLED }, balanceInPaise: { $gt: 0 } }, 'balanceInPaise') : Promise.resolve(0),
      canPayments ? sum(userId, { kind: 'expense', status: { $nin: ['cancelled', 'rejected'] }, createdAt: { $gte: month.start, $lt: month.end } }) : Promise.resolve(0),
      canPayments ? sum(userId, { kind: { $in: ['order', 'invoice'] }, balanceInPaise: { $gt: 0 }, dueAt: { $gte: now } }, 'balanceInPaise') : Promise.resolve(0),
      canPayments ? sum(userId, { kind: { $in: ['order', 'invoice'] }, balanceInPaise: { $gt: 0 }, dueAt: { $lt: now, $gte: d30 } }, 'balanceInPaise') : Promise.resolve(0),
      canPayments ? sum(userId, { kind: { $in: ['order', 'invoice'] }, balanceInPaise: { $gt: 0 }, dueAt: { $lt: d30, $gte: d60 } }, 'balanceInPaise') : Promise.resolve(0),
      canPayments ? sum(userId, { kind: { $in: ['order', 'invoice'] }, balanceInPaise: { $gt: 0 }, $or: [{ dueAt: { $lt: d60 } }, { dueAt: null }] }, 'balanceInPaise') : Promise.resolve(0),
    ]);

    const recent = await SmbRecord.find({ userId, kind: { $in: Array.from(allowed) } })
      .sort({ updatedAt: -1 }).limit(8).populate('contactId', 'name phone category').lean();

    return NextResponse.json({ success: true, data: {
      leadsOpen, followupsDue, followupsOverdue, quotationsOpen, openOrders, deliveriesOpen,
      tasksDue, tasksOverdue, sopsActive, responsibilitiesActive, vendorsActive, productsActive, pendingReviews,
      paymentRemindersOpen, purchaseOrdersOpen, rateCardsActive,
      socialContentCount, socialApprovalsOpen, socialScheduledOpen,
      salesMonthPaise, collectedMonthPaise, outstandingPaise, expensesMonthPaise,
      aging: { currentPaise: agingCurrentPaise, days1to30Paise: aging30Paise, days31to60Paise: aging60Paise, days61PlusPaise: aging90PlusPaise },
      recent, generatedAt: now.toISOString(),
    } });
  } catch (error) {
    return errorResponse(error, 'Failed to load small-business summary');
  }
}
