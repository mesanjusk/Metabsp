import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import SmbRecord from '@/lib/models/SmbRecord';

const CLOSED = ['completed', 'paid', 'done', 'closed', 'cancelled', 'lost', 'rejected'];
const money = (paise: number) => `₹${Math.round(Number(paise || 0) / 100).toLocaleString('en-IN')}`;

async function list(userId: any, match: Record<string, any>, limit = 8) {
  return SmbRecord.find({ userId, ...match })
    .sort({ dueAt: 1, updatedAt: -1 })
    .limit(limit)
    .populate('contactId', 'name phone category assignedAgent')
    .lean();
}

async function sum(userId: any, match: Record<string, any>, field = 'amountInPaise') {
  const [row] = await SmbRecord.aggregate([
    { $match: { userId, ...match } },
    { $group: { _id: null, value: { $sum: `$${field}` } } },
  ]);
  return Number(row?.value || 0);
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const userId = authed.doc._id;
    const body = await req.json();
    const question = String(body?.question || '').trim();
    if (!question) return NextResponse.json({ success: false, message: 'Question is required' }, { status: 400 });

    const q = question.toLowerCase();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    let answer = '';
    let items: any[] = [];
    let mode = 'summary';

    if (/follow.?up|call back|callback/.test(q)) {
      mode = 'followups';
      items = await list(userId, { kind: 'followup', status: { $nin: CLOSED }, dueAt: { $lte: now } }, 12);
      answer = items.length ? `You have ${items.length} due or overdue follow-up${items.length === 1 ? '' : 's'} needing attention.` : 'There are no due follow-ups right now.';
    } else if (/outstanding|balance|collect|payment due|money due/.test(q)) {
      mode = 'outstanding';
      items = await list(userId, { kind: 'order', status: { $nin: ['cancelled', 'lost', 'rejected'] }, balanceInPaise: { $gt: 0 } }, 12);
      const total = items.reduce((acc, item: any) => acc + Number(item.balanceInPaise || 0), 0);
      answer = items.length ? `${money(total)} is outstanding across the ${items.length} highest-priority records shown.` : 'There are no orders with a recorded outstanding balance.';
    } else if (/task|delay|overdue|pending work/.test(q)) {
      mode = 'tasks';
      items = await list(userId, { kind: 'task', status: { $nin: CLOSED }, dueAt: { $lte: now } }, 12);
      answer = items.length ? `${items.length} due or overdue task${items.length === 1 ? '' : 's'} need attention.` : 'There are no due tasks right now.';
    } else if (/expense|spend|cost/.test(q)) {
      mode = 'expenses';
      const total = await sum(userId, { kind: 'expense', status: { $nin: ['cancelled', 'rejected'] }, createdAt: { $gte: monthStart, $lt: monthEnd } });
      items = await list(userId, { kind: 'expense', createdAt: { $gte: monthStart, $lt: monthEnd } }, 8);
      answer = `Recorded expenses this month are ${money(total)}.`;
    } else if (/sales|revenue|business this month|month sales/.test(q)) {
      mode = 'sales';
      const sales = await sum(userId, { kind: 'order', status: { $nin: ['cancelled', 'lost', 'rejected'] }, createdAt: { $gte: monthStart, $lt: monthEnd } });
      const collected = await sum(userId, { kind: 'payment', status: { $nin: ['cancelled', 'failed', 'rejected'] }, createdAt: { $gte: monthStart, $lt: monthEnd } });
      answer = `This month you have ${money(sales)} in recorded orders and ${money(collected)} in recorded collections.`;
    } else if (/order|job/.test(q)) {
      mode = 'orders';
      items = await list(userId, { kind: 'order', status: { $nin: CLOSED } }, 12);
      answer = items.length ? `${items.length} open order${items.length === 1 ? '' : 's'} are shown below.` : 'There are no open orders.';
    } else if (/lead|enquir|prospect|convert/.test(q)) {
      mode = 'leads';
      items = await list(userId, { kind: 'lead', status: { $nin: CLOSED } }, 12);
      answer = items.length ? `${items.length} open lead${items.length === 1 ? '' : 's'} are shown below.` : 'There are no open leads.';
    } else {
      const [leads, followups, orders, tasks, outstanding] = await Promise.all([
        SmbRecord.countDocuments({ userId, kind: 'lead', status: { $nin: CLOSED } }),
        SmbRecord.countDocuments({ userId, kind: 'followup', status: { $nin: CLOSED }, dueAt: { $lte: now } }),
        SmbRecord.countDocuments({ userId, kind: 'order', status: { $nin: CLOSED } }),
        SmbRecord.countDocuments({ userId, kind: 'task', status: { $nin: CLOSED }, dueAt: { $lte: now } }),
        sum(userId, { kind: 'order', status: { $nin: ['cancelled', 'lost', 'rejected'] }, balanceInPaise: { $gt: 0 } }, 'balanceInPaise'),
      ]);
      answer = `Right now: ${leads} open leads, ${followups} due follow-ups, ${orders} open orders, ${tasks} due tasks and ${money(outstanding)} outstanding.`;
    }

    return NextResponse.json({ success: true, data: { answer, mode, items, groundedIn: 'live_workspace_records' } });
  } catch (error) {
    return errorResponse(error, 'Failed to answer business question');
  }
}
