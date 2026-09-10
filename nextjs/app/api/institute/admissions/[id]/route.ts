import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteAdmission, InstituteFee, InstituteRecord } from '@/lib/models';
import { admissionApiItem, findInstituteStudent, instituteScope } from '@/lib/institute/nativeAdmissions';

function idFilter(id: string) {
  const value = String(id || '').trim();
  return mongoose.isValidObjectId(value) ? { $or: [{ _id: value }, { admissionUuid: value }] } : { admissionUuid: value };
}

function legacyFilter(id: string) {
  const value = String(id || '').trim();
  const ors: any[] = [{ legacyId: value }, { 'payload.uuid': value }];
  if (mongoose.isValidObjectId(value)) ors.unshift({ _id: value });
  return { $or: ors };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    const admission: any = await InstituteAdmission.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...idFilter(id) }).lean();
    if (!admission) {
      const legacy: any = await InstituteRecord.findOne({ ...instituteScope(authed), entityType: 'admissions', archived: { $ne: true }, ...legacyFilter(id) }).lean();
      if (!legacy) return NextResponse.json({ success: false, message: 'Admission not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: { ...legacy, _id: String(legacy._id), source: legacy.source || 'legacy' } });
    }
    const [student, fee] = await Promise.all([
      InstituteRecord.findById(admission.studentRecordId).lean(),
      InstituteFee.findOne({ admissionId: admission._id, archived: { $ne: true } }).lean(),
    ]);
    return NextResponse.json({ success: true, data: admissionApiItem(admission, student, fee) });
  } catch (error) {
    return errorResponse(error, 'Failed to load admission');
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    const body: any = await req.json().catch(() => ({}));
    const admission: any = await InstituteAdmission.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...idFilter(id) });
    if (!admission) {
      const legacy: any = await InstituteRecord.findOne({ ...instituteScope(authed), entityType: 'admissions', archived: { $ne: true }, ...legacyFilter(id) });
      if (!legacy) return NextResponse.json({ success: false, message: 'Admission not found' }, { status: 404 });
      const payload = { ...(legacy.payload || {}), ...body };
      delete payload._id; delete payload.tenantId; delete payload.ownerUserId; delete payload.entityType;
      legacy.payload = payload;
      await legacy.save();
      return NextResponse.json({ success: true, data: { ...legacy.toObject(), _id: String(legacy._id), source: legacy.source || 'legacy' } });
    }

    if (body.studentRecordId || body.student_uuid) {
      const student = await findInstituteStudent(authed, body.studentRecordId || body.student_uuid);
      if (!student) return NextResponse.json({ success: false, message: 'Student not found' }, { status: 404 });
      admission.studentRecordId = student._id;
      admission.studentLegacyId = String(student.legacyId || student?.payload?.uuid || '');
    }
    if (body.admissionDate) admission.admissionDate = new Date(body.admissionDate);
    if (body.course !== undefined) {
      const course = String(body.course || '').trim();
      if (!course) return NextResponse.json({ success: false, message: 'Course is required' }, { status: 400 });
      admission.course = course;
    }
    if (body.batchTime !== undefined) admission.batchTime = String(body.batchTime || '');
    if (body.examEvent !== undefined) admission.examEvent = String(body.examEvent || '');
    if (body.confirmationStatus !== undefined) {
      if (!['', 'Confirmed', 'DropOut'].includes(body.confirmationStatus)) {
        return NextResponse.json({ success: false, message: 'Invalid admission status' }, { status: 400 });
      }
      admission.confirmationStatus = body.confirmationStatus;
    }
    if (body.dropoutReason !== undefined) admission.dropoutReason = String(body.dropoutReason || '');
    admission.updatedBy = authed.id;
    await admission.save();

    const [student, fee] = await Promise.all([
      InstituteRecord.findById(admission.studentRecordId).lean(),
      InstituteFee.findOne({ admissionId: admission._id, archived: { $ne: true } }).lean(),
    ]);
    return NextResponse.json({ success: true, data: admissionApiItem(admission.toObject(), student, fee) });
  } catch (error) {
    return errorResponse(error, 'Failed to update admission');
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    const admission: any = await InstituteAdmission.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...idFilter(id) });
    if (!admission) {
      const legacy: any = await InstituteRecord.findOne({ ...instituteScope(authed), entityType: 'admissions', archived: { $ne: true }, ...legacyFilter(id) });
      if (!legacy) return NextResponse.json({ success: false, message: 'Admission not found' }, { status: 404 });
      legacy.archived = true;
      await legacy.save();
      return NextResponse.json({ success: true, message: 'Admission archived' });
    }
    admission.archived = true;
    admission.updatedBy = authed.id;
    await admission.save();
    await InstituteFee.updateMany({ ...instituteScope(authed), admissionId: admission._id }, { $set: { archived: true, updatedBy: authed.id } });
    return NextResponse.json({ success: true, message: 'Admission archived' });
  } catch (error) {
    return errorResponse(error, 'Failed to delete admission');
  }
}
