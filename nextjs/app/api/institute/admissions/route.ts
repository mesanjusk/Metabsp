import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteAdmission, InstituteFee, InstituteRecord } from '@/lib/models';
import { admissionApiItem, findInstituteStudent, instituteScope } from '@/lib/institute/nativeAdmissions';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const url = new URL(req.url);
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const course = String(url.searchParams.get('course') || '').trim();
    const status = String(url.searchParams.get('status') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 50)));

    const filter: any = { ...instituteScope(authed), archived: { $ne: true } };
    if (course) filter.course = course;
    if (status) filter.confirmationStatus = status;

    const admissions: any[] = await InstituteAdmission.find(filter).sort({ admissionDate: -1, createdAt: -1 }).lean();
    const studentIds = admissions.map((a) => a.studentRecordId).filter(Boolean);
    const feeAdmissionIds = admissions.map((a) => a._id);
    const [students, fees] = await Promise.all([
      InstituteRecord.find({ _id: { $in: studentIds } }).lean(),
      InstituteFee.find({ admissionId: { $in: feeAdmissionIds }, archived: { $ne: true } }).lean(),
    ]);
    const studentsById = new Map(students.map((s: any) => [String(s._id), s]));
    const feesByAdmission = new Map(fees.map((f: any) => [String(f.admissionId), f]));
    let data = admissions.map((a) => admissionApiItem(a, studentsById.get(String(a.studentRecordId)), feesByAdmission.get(String(a._id))));

    if (q) {
      data = data.filter((item: any) => {
        const p = item.payload || {};
        return [item.legacyId, p.studentName, p.mobileSelf, p.mobileParent, p.course, p.batchTime, p.confirmationStatus]
          .some((value) => String(value || '').toLowerCase().includes(q));
      });
    }

    const total = data.length;
    const sliced = data.slice((page - 1) * limit, page * limit);
    return NextResponse.json({ success: true, data: sliced, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    return errorResponse(error, 'Failed to load admissions');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body: any = await req.json().catch(() => ({}));
    const studentRef = String(body.studentRecordId || body.student_uuid || '').trim();
    const student = await findInstituteStudent(authed, studentRef);
    if (!student) return NextResponse.json({ success: false, message: 'Student not found' }, { status: 404 });
    const course = String(body.course || '').trim();
    if (!course) return NextResponse.json({ success: false, message: 'Course is required' }, { status: 400 });

    const admission = await InstituteAdmission.create({
      ...instituteScope(authed),
      ownerUserId: authed.id,
      admissionUuid: randomUUID(),
      studentRecordId: student._id,
      studentLegacyId: String(student.legacyId || student?.payload?.uuid || ''),
      admissionDate: body.admissionDate ? new Date(body.admissionDate) : new Date(),
      course,
      batchTime: String(body.batchTime || ''),
      examEvent: String(body.examEvent || ''),
      confirmationStatus: ['', 'Confirmed', 'DropOut'].includes(body.confirmationStatus) ? body.confirmationStatus : '',
      dropoutReason: String(body.dropoutReason || ''),
      sourceLeadRecordId: body.sourceLeadRecordId || null,
      createdBy: authed.id,
    });

    return NextResponse.json({ success: true, data: admissionApiItem(admission, student) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create admission');
  }
}
