import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteAdmission, InstituteFee, InstituteRecord } from '@/lib/models';
import { createNativeFee, feeApiItem, findInstituteStudent, instituteScope, normalizeMoney } from '@/lib/institute/nativeAdmissions';

function admissionRefFilter(value: string) {
  const ref = String(value || '').trim();
  return mongoose.isValidObjectId(ref) ? { $or: [{ _id: ref }, { admissionUuid: ref }] } : { admissionUuid: ref };
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const url = new URL(req.url);
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const dueDate = String(url.searchParams.get('date') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 50)));

    const fees: any[] = await InstituteFee.find({ ...instituteScope(authed), archived: { $ne: true } }).sort({ updatedAt: -1 }).lean();
    const studentIds = fees.map((f) => f.studentRecordId).filter(Boolean);
    const admissionIds = fees.map((f) => f.admissionId).filter(Boolean);
    const [students, admissions] = await Promise.all([
      InstituteRecord.find({ _id: { $in: studentIds } }).lean(),
      InstituteAdmission.find({ _id: { $in: admissionIds }, archived: { $ne: true } }).lean(),
    ]);
    const studentById = new Map(students.map((s: any) => [String(s._id), s]));
    const admissionById = new Map(admissions.map((a: any) => [String(a._id), a]));
    let data = fees.map((f) => feeApiItem(f, studentById.get(String(f.studentRecordId)), admissionById.get(String(f.admissionId))));

    if (dueDate) {
      data = data.filter((item: any) => (item.payload.installmentPlan || []).some((row: any) => {
        if (!row?.dueDate) return false;
        return new Date(row.dueDate).toISOString().slice(0, 10) === dueDate;
      }));
    }
    if (q) {
      data = data.filter((item: any) => {
        const p = item.payload || {};
        return [p.studentName, p.student_uuid, p.admission_uuid, p.course, p.paidBy]
          .some((value) => String(value || '').toLowerCase().includes(q));
      });
    }

    const total = data.length;
    return NextResponse.json({
      success: true,
      data: data.slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      summary: {
        billed: normalizeMoney(data.reduce((sum: number, item: any) => sum + Number(item.payload.total || 0), 0)),
        paid: normalizeMoney(data.reduce((sum: number, item: any) => sum + Number(item.payload.feePaid || 0), 0)),
        outstanding: normalizeMoney(data.reduce((sum: number, item: any) => sum + Number(item.payload.balance || 0), 0)),
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load fees');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body: any = await req.json().catch(() => ({}));
    const admissionRef = String(body.admissionId || body.admission_uuid || '').trim();
    if (!admissionRef) return NextResponse.json({ success: false, message: 'Admission is required' }, { status: 400 });
    const admission: any = await InstituteAdmission.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...admissionRefFilter(admissionRef) });
    if (!admission) return NextResponse.json({ success: false, message: 'Admission not found' }, { status: 404 });
    const student = await findInstituteStudent(authed, String(admission.studentRecordId));
    if (!student) return NextResponse.json({ success: false, message: 'Student not found' }, { status: 404 });
    const existing = await InstituteFee.findOne({ ...instituteScope(authed), admissionId: admission._id, archived: { $ne: true } });
    if (existing) return NextResponse.json({ success: false, message: 'Fee plan already exists for this admission' }, { status: 409 });

    const fee = await createNativeFee({
      authed,
      admission,
      student,
      fees: body.fees,
      discount: body.discount,
      feePaid: body.feePaid,
      paidBy: body.paidBy,
      installment: body.installment,
      firstDueDate: body.emiDate || body.firstDueDate || null,
    });
    return NextResponse.json({ success: true, data: feeApiItem(fee, student, admission) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create fee plan');
  }
}
