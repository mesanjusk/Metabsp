import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteAdmission, InstituteFee, InstituteRecord } from '@/lib/models';
import { buildInstallmentPlan, feeApiItem, instituteScope, normalizeMoney } from '@/lib/institute/nativeAdmissions';

function feeFilter(id: string) {
  const value = String(id || '').trim();
  return mongoose.isValidObjectId(value) ? { $or: [{ _id: value }, { feeUuid: value }] } : { feeUuid: value };
}

async function joinedItem(fee: any) {
  const [student, admission] = await Promise.all([
    InstituteRecord.findById(fee.studentRecordId).lean(),
    InstituteAdmission.findById(fee.admissionId).lean(),
  ]);
  return feeApiItem(fee.toObject ? fee.toObject() : fee, student, admission);
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    const fee: any = await InstituteFee.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...feeFilter(id) });
    if (!fee) return NextResponse.json({ success: false, message: 'Fee plan not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: await joinedItem(fee) });
  } catch (error) {
    return errorResponse(error, 'Failed to load fee plan');
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    const body: any = await req.json().catch(() => ({}));
    const fee: any = await InstituteFee.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...feeFilter(id) });
    if (!fee) return NextResponse.json({ success: false, message: 'Fee plan not found' }, { status: 404 });

    const fees = body.fees !== undefined ? normalizeMoney(body.fees) : normalizeMoney(fee.fees);
    const discount = body.discount !== undefined ? normalizeMoney(body.discount) : normalizeMoney(fee.discount);
    if (fees < 0 || discount < 0 || discount > fees) {
      return NextResponse.json({ success: false, message: 'Invalid fees or discount' }, { status: 400 });
    }
    const total = normalizeMoney(fees - discount);
    if (fee.feePaid > total) return NextResponse.json({ success: false, message: 'New total cannot be lower than amount already paid' }, { status: 400 });
    const balance = normalizeMoney(total - Number(fee.feePaid || 0));
    const installment = body.installment !== undefined ? Math.max(0, Math.floor(Number(body.installment || 0))) : Number(fee.installment || 0);

    fee.fees = fees;
    fee.discount = discount;
    fee.total = total;
    fee.balance = balance;
    fee.paidBy = body.paidBy !== undefined ? String(body.paidBy || '') : fee.paidBy;
    fee.installment = installment;
    fee.emi = installment > 0 ? normalizeMoney(balance / installment) : 0;
    if (body.installment !== undefined || body.emiDate || body.firstDueDate) {
      fee.installmentPlan = buildInstallmentPlan(balance, installment, body.emiDate || body.firstDueDate || null);
    }
    fee.updatedBy = authed.id;
    await fee.save();
    return NextResponse.json({ success: true, data: await joinedItem(fee) });
  } catch (error) {
    return errorResponse(error, 'Failed to update fee plan');
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    const fee: any = await InstituteFee.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...feeFilter(id) });
    if (!fee) return NextResponse.json({ success: false, message: 'Fee plan not found' }, { status: 404 });
    fee.archived = true;
    fee.updatedBy = authed.id;
    await fee.save();
    return NextResponse.json({ success: true, message: 'Fee plan archived' });
  } catch (error) {
    return errorResponse(error, 'Failed to delete fee plan');
  }
}
