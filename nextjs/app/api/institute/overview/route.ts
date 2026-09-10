import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteRecord } from '@/lib/models';

function scopeFor(authed: any) {
  return authed.tenantId
    ? { tenantId: authed.tenantId }
    : { tenantId: null, ownerUserId: authed.id };
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const scope = scopeFor(authed);

    const [counts, recent] = await Promise.all([
      InstituteRecord.aggregate([
        { $match: { ...scope, archived: { $ne: true } } },
        { $group: { _id: '$entityType', count: { $sum: 1 } } },
      ]),
      InstituteRecord.find({ ...scope, archived: { $ne: true } })
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean(),
    ]);

    const byType = Object.fromEntries(counts.map((entry: any) => [entry._id, entry.count]));
    const fees: any[] = await InstituteRecord.find({ ...scope, entityType: 'fees', archived: { $ne: true } }).lean();
    const feeTotals = fees.reduce(
      (acc, item: any) => {
        const payload = item.payload || {};
        acc.total += Number(payload.total || payload.fees || 0);
        acc.paid += Number(payload.feePaid || payload.paid || 0);
        acc.balance += Number(payload.balance || 0);
        return acc;
      },
      { total: 0, paid: 0, balance: 0 }
    );

    return NextResponse.json({
      success: true,
      data: {
        counts: byType,
        kpis: {
          students: Number(byType.students || 0),
          leads: Number(byType.leads || 0),
          admissions: Number(byType.admissions || 0),
          employees: Number(byType.employees || 0),
          courses: Number(byType.courses || 0),
          batches: Number(byType.batches || 0),
          feeBalance: feeTotals.balance,
          feesCollected: feeTotals.paid,
        },
        recent,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load institute overview');
  }
}
