import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteIDCardProject, InstituteIDCardStudent, InstituteRecord } from '@/lib/models';
import { instituteScope, normalizeImportedStudent, studentDto } from '@/lib/institute/idCards';

function projectFilter(id: string) {
  const v = String(id || '').trim();
  return mongoose.isValidObjectId(v) ? { $or: [{ _id: v }, { projectUuid: v }] } : { projectUuid: v };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    const project: any = await InstituteIDCardProject.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...projectFilter(id) }).lean();
    if (!project) return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
    const url = new URL(req.url);
    const className = String(url.searchParams.get('class_name') || '');
    const cardStatus = String(url.searchParams.get('card_status') || '');
    const filter: any = { ...instituteScope(authed), projectId: project._id, archived: { $ne: true } };
    if (className) filter.className = className;
    if (cardStatus) filter.cardStatus = cardStatus;
    const rows: any[] = await InstituteIDCardStudent.find(filter).sort({ className: 1, rollNumber: 1, studentName: 1 }).lean();
    return NextResponse.json({ success: true, data: rows.map(studentDto) });
  } catch (error) { return errorResponse(error, 'Failed to load ID card students'); }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    const project: any = await InstituteIDCardProject.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...projectFilter(id) }).lean();
    if (!project) return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
    const body: any = await req.json().catch(() => ({}));
    const students = Array.isArray(body.students) ? body.students : [];
    if (!students.length) return NextResponse.json({ success: false, message: 'students array is required' }, { status: 400 });

    const docs = [];
    for (const raw of students.slice(0, 2000)) {
      const n = normalizeImportedStudent(raw);
      let studentRecordId: any = null;
      const recordRef = raw.studentRecordId || raw.student_record_id || raw.student_uuid || raw._id;
      if (recordRef) {
        const sf: any = { ...instituteScope(authed), entityType: 'students', archived: { $ne: true } };
        sf.$or = mongoose.isValidObjectId(String(recordRef)) ? [{ _id: recordRef }, { legacyId: String(recordRef) }] : [{ legacyId: String(recordRef) }];
        const existing: any = await InstituteRecord.findOne(sf).select('_id').lean();
        studentRecordId = existing?._id || null;
      }
      docs.push({
        ...instituteScope(authed),
        ownerUserId: authed.id,
        idcardUuid: randomUUID(),
        projectId: project._id,
        studentRecordId,
        ...n,
      });
    }
    const inserted = await InstituteIDCardStudent.insertMany(docs, { ordered: false });
    return NextResponse.json({ success: true, count: inserted.length, data: inserted.map(studentDto) }, { status: 201 });
  } catch (error) { return errorResponse(error, 'Failed to import ID card students'); }
}
