import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteAdmission, InstituteRecord } from '@/lib/models';
import {
  admissionApiItem,
  createNativeFee,
  findInstituteStudent,
  instituteScope,
  normalizeMoney,
  syncStudentToSharedContact,
} from '@/lib/institute/nativeAdmissions';

function cleanPhone(value: any) {
  return String(value || '').replace(/\D/g, '');
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body: any = await req.json().catch(() => ({}));
    const course = String(body.course || '').trim();
    if (!course) return NextResponse.json({ success: false, message: 'Course is required' }, { status: 400 });

    let student: any = null;
    if (body.studentRecordId || body.student_uuid) {
      student = await findInstituteStudent(authed, body.studentRecordId || body.student_uuid);
      if (!student) return NextResponse.json({ success: false, message: 'Selected student not found' }, { status: 404 });
    } else {
      const firstName = String(body.firstName || '').trim();
      const mobileSelf = cleanPhone(body.mobileSelf);
      if (!firstName) return NextResponse.json({ success: false, message: 'Student first name is required' }, { status: 400 });
      if (mobileSelf && mobileSelf.length < 10) return NextResponse.json({ success: false, message: 'Enter a valid student mobile number' }, { status: 400 });

      if (mobileSelf) {
        student = await InstituteRecord.findOne({
          ...instituteScope(authed),
          entityType: 'students',
          archived: { $ne: true },
          'payload.mobileSelf': mobileSelf,
        });
        if (student) {
          return NextResponse.json({ success: false, message: 'A student with this mobile number already exists. Select the existing student instead.' }, { status: 409 });
        }
      }

      const studentUuid = randomUUID();
      student = await InstituteRecord.create({
        ...instituteScope(authed),
        ownerUserId: authed.id,
        entityType: 'students',
        legacyId: studentUuid,
        source: 'metabsp',
        payload: {
          uuid: studentUuid,
          firstName,
          middleName: String(body.middleName || '').trim(),
          lastName: String(body.lastName || '').trim(),
          dob: body.dob || '',
          gender: body.gender || '',
          mobileSelf,
          mobileSelfWhatsapp: Boolean(body.mobileSelfWhatsapp),
          mobileParent: cleanPhone(body.mobileParent),
          mobileParentWhatsapp: Boolean(body.mobileParentWhatsapp),
          address: String(body.address || '').trim(),
          education: String(body.education || '').trim(),
          schoolName: String(body.schoolName || '').trim(),
          regNo: String(body.regNo || '').trim(),
        },
      });
      await syncStudentToSharedContact(authed, student);
    }

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
      confirmationStatus: 'Confirmed',
      sourceLeadRecordId: body.sourceLeadRecordId || null,
      createdBy: authed.id,
    });

    const fees = normalizeMoney(body.fees);
    const discount = normalizeMoney(body.discount);
    const feePaid = normalizeMoney(body.feePaid);
    const fee = fees > 0
      ? await createNativeFee({
          authed,
          admission,
          student,
          fees,
          discount,
          feePaid,
          paidBy: body.paidBy,
          installment: body.installment,
          firstDueDate: body.emiDate || body.firstDueDate || null,
        })
      : null;

    if (body.sourceLeadRecordId) {
      await InstituteRecord.updateOne(
        { ...instituteScope(authed), _id: body.sourceLeadRecordId, entityType: 'leads', archived: { $ne: true } },
        {
          $set: {
            'payload.admission_uuid': admission.admissionUuid,
            'payload.status': 'converted',
            'payload.followupDate': null,
          },
          $push: {
            'payload.followups': {
              date: new Date(),
              status: 'converted',
              note: 'Converted to admission',
              createdBy: authed.id,
            },
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: admissionApiItem(admission, student, fee),
      student: { _id: String(student._id), legacyId: student.legacyId, payload: student.payload },
      fee: fee ? { _id: String(fee._id), feeUuid: fee.feeUuid, total: fee.total, feePaid: fee.feePaid, balance: fee.balance } : null,
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to complete admission workflow');
  }
}
