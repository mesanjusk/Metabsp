import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { Contact, InstituteAdmission, InstituteFee, InstituteRecord } from '@/lib/models';

export function instituteScope(authed: any) {
  return authed.tenantId
    ? { tenantId: authed.tenantId }
    : { tenantId: null, ownerUserId: authed.id };
}

export async function findInstituteStudent(authed: any, ref: string) {
  const value = String(ref || '').trim();
  if (!value) return null;
  const scope = instituteScope(authed);
  const ors: any[] = [{ legacyId: value }, { 'payload.uuid': value }];
  if (mongoose.isValidObjectId(value)) ors.unshift({ _id: value });
  return InstituteRecord.findOne({ ...scope, entityType: 'students', archived: { $ne: true }, $or: ors });
}

export function studentName(student: any) {
  const p = student?.payload || {};
  return String(p.name || [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || p.studentName || '').trim();
}

export function normalizeMoney(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function buildInstallmentPlan(totalBalance: number, count: number, firstDueDate?: string | Date | null) {
  const balance = normalizeMoney(totalBalance);
  const installments = Math.max(0, Math.floor(Number(count || 0)));
  if (!installments || balance <= 0) return [];
  const baseDate = firstDueDate ? new Date(firstDueDate) : new Date();
  if (Number.isNaN(baseDate.getTime())) throw new Error('Invalid first installment date');
  const regular = normalizeMoney(balance / installments);
  let remaining = balance;
  return Array.from({ length: installments }, (_, index) => {
    const due = new Date(baseDate);
    due.setMonth(due.getMonth() + index);
    const amount = index === installments - 1 ? normalizeMoney(remaining) : regular;
    remaining = normalizeMoney(remaining - amount);
    return { installmentNo: index + 1, dueDate: due, amount, paidAmount: 0, status: 'pending' };
  });
}

export async function syncStudentToSharedContact(authed: any, student: any) {
  const p = student?.payload || {};
  const phone = String(p.mobileSelf || p.mobileParent || '').replace(/\D/g, '');
  if (!phone) return;
  const name = studentName(student);
  await Contact.findOneAndUpdate(
    { userId: authed.id, phone },
    {
      $set: {
        name,
        category: 'Student',
        'customFields.instituteResource': 'students',
        'customFields.instituteRecordId': String(student._id),
        'customFields.instituteLegacyId': String(student.legacyId || p.uuid || ''),
      },
      $setOnInsert: { userId: authed.id, phone },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function createNativeFee(params: {
  authed: any;
  admission: any;
  student: any;
  fees: any;
  discount?: any;
  feePaid?: any;
  paidBy?: string;
  installment?: any;
  firstDueDate?: string | Date | null;
}) {
  const { authed, admission, student } = params;
  const fees = normalizeMoney(params.fees);
  const discount = normalizeMoney(params.discount);
  const feePaid = normalizeMoney(params.feePaid);
  if (fees < 0 || discount < 0 || feePaid < 0) throw new Error('Fee amounts cannot be negative');
  if (discount > fees) throw new Error('Discount cannot exceed fees');
  const total = normalizeMoney(fees - discount);
  if (feePaid > total) throw new Error('Fee paid cannot exceed total');
  const balance = normalizeMoney(total - feePaid);
  const installment = Math.max(0, Math.floor(Number(params.installment || 0)));
  const installmentPlan = buildInstallmentPlan(balance, installment, params.firstDueDate);
  const receipts = feePaid > 0
    ? [{ receiptNo: `RCPT-${Date.now()}`, amount: feePaid, paidAt: new Date(), paymentMode: String(params.paidBy || ''), createdBy: authed.id }]
    : [];

  return InstituteFee.create({
    ...instituteScope(authed),
    ownerUserId: authed.id,
    feeUuid: randomUUID(),
    admissionId: admission._id,
    admissionUuid: admission.admissionUuid,
    studentRecordId: student._id,
    studentLegacyId: String(student.legacyId || student?.payload?.uuid || ''),
    fees,
    discount,
    total,
    feePaid,
    balance,
    paidBy: String(params.paidBy || ''),
    installment,
    emi: installment > 0 ? normalizeMoney(balance / installment) : 0,
    installmentPlan,
    receipts,
    createdBy: authed.id,
  });
}

export function admissionApiItem(admission: any, student?: any, fee?: any) {
  const p = student?.payload || {};
  return {
    _id: String(admission._id),
    legacyId: admission.admissionUuid,
    source: 'native',
    createdAt: admission.createdAt,
    updatedAt: admission.updatedAt,
    payload: {
      uuid: admission.admissionUuid,
      student_uuid: admission.studentLegacyId || String(admission.studentRecordId),
      studentRecordId: String(admission.studentRecordId),
      studentName: studentName(student),
      mobileSelf: p.mobileSelf || '',
      mobileParent: p.mobileParent || '',
      admissionDate: admission.admissionDate,
      course: admission.course,
      batchTime: admission.batchTime || '',
      examEvent: admission.examEvent || '',
      confirmationStatus: admission.confirmationStatus || '',
      dropoutReason: admission.dropoutReason || '',
      feeUuid: fee?.feeUuid || '',
      fees: fee?.fees ?? null,
      discount: fee?.discount ?? null,
      total: fee?.total ?? null,
      feePaid: fee?.feePaid ?? null,
      balance: fee?.balance ?? null,
    },
  };
}

export function feeApiItem(fee: any, student?: any, admission?: any) {
  return {
    _id: String(fee._id),
    legacyId: fee.feeUuid,
    source: 'native',
    createdAt: fee.createdAt,
    updatedAt: fee.updatedAt,
    payload: {
      uuid: fee.feeUuid,
      student_uuid: fee.studentLegacyId || String(fee.studentRecordId),
      studentRecordId: String(fee.studentRecordId),
      studentName: studentName(student),
      admission_uuid: fee.admissionUuid,
      admissionId: String(fee.admissionId),
      course: admission?.course || '',
      fees: fee.fees,
      discount: fee.discount,
      total: fee.total,
      feePaid: fee.feePaid,
      paidBy: fee.paidBy || '',
      balance: fee.balance,
      emi: fee.emi,
      installment: fee.installment,
      installmentPlan: fee.installmentPlan || [],
      receipts: fee.receipts || [],
    },
  };
}
