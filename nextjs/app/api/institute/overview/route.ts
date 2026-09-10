import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteAdmission, InstituteFee, InstituteRecord } from '@/lib/models';

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

    const [counts, recent, nativeAdmissions, nativeFees] = await Promise.all([
      InstituteRecord.aggregate([
        { $match: { ...scope, archived: { $ne: true } } },
        { $group: { _id: '$entityType', count: { $sum: 1 } } },
      ]),
      InstituteRecord.find({ ...scope, archived: { $ne: true } }).sort({ updatedAt: -1 }).limit(8).lean(),
      InstituteAdmission.countDocuments({ ...scope, archived: { $ne: true } }),
      InstituteFee.find({ ...scope, archived: { $ne: true } }, { total: 1, feePaid: 1, balance: 1 }).lean(),
    ]);

    const byType = Object.fromEntries(counts.map((entry: any) => [entry._id, entry.count]));
    const legacyFees: any[] = await InstituteRecord.find({ ...scope, entityType: 'fees', archived: { $ne: true } }).lean();
    const legacyFeeTotals = legacyFees.reduce(
      (acc, item: any) => {
        const payload = item.payload || {};
        acc.total += Number(payload.total || payload.fees || 0);
        acc.paid += Number(payload.feePaid || payload.paid || 0);
        acc.balance += Number(payload.balance || 0);
        return acc;
      },
      { total: 0, paid: 0, balance: 0 }
    );
    const nativeFeeTotals = nativeFees.reduce(
      (acc: any, fee: any) => {
        acc.total += Number(fee.total || 0);
        acc.paid += Number(fee.feePaid || 0);
        acc.balance += Number(fee.balance || 0);
        return acc;
      },
      { total: 0, paid: 0, balance: 0 }
    );

    return NextResponse.json({
      success: true,
      data: {
        counts: { ...byType, admissions: Number(byType.admissions || 0) + nativeAdmissions, fees: Number(byType.fees || 0) + nativeFees.length },
        kpis: {
          students: Number(byType.students || 0),
          leads: Number(byType.leads || 0),
          admissions: Number(byType.admissions || 0) + nativeAdmissions,
          employees: Number(byType.employees || 0),
          courses: Number(byType.courses || 0),
          batches: Number(byType.batches || 0),
          feeBalance: legacyFeeTotals.balance + nativeFeeTotals.balance,
          feesCollected: legacyFeeTotals.paid + nativeFeeTotals.paid,
        },
        recent,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load institute overview');
  }
}
