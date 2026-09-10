import mongoose, { Schema } from 'mongoose';

const InstallmentSchema = new Schema(
  {
    installmentNo: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    paidAt: { type: Date, default: null },
    status: { type: String, enum: ['pending', 'partial', 'paid'], default: 'pending' },
  },
  { _id: false }
);

const ReceiptSchema = new Schema(
  {
    receiptNo: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
    paymentMode: { type: String, default: '', trim: true },
    reference: { type: String, default: '', trim: true },
    note: { type: String, default: '', trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true }
);

const InstituteFeeSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    feeUuid: { type: String, required: true, index: true },
    admissionId: { type: Schema.Types.ObjectId, ref: 'InstituteAdmission', required: true, index: true },
    admissionUuid: { type: String, required: true, index: true },
    studentRecordId: { type: Schema.Types.ObjectId, ref: 'InstituteRecord', required: true, index: true },
    studentLegacyId: { type: String, default: '', index: true },
    fees: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    feePaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, required: true, min: 0 },
    paidBy: { type: String, default: '', trim: true },
    emi: { type: Number, default: 0, min: 0 },
    installment: { type: Number, default: 0, min: 0 },
    installmentPlan: { type: [InstallmentSchema], default: [] },
    receipts: { type: [ReceiptSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: 'institute_fees' }
);

InstituteFeeSchema.index({ tenantId: 1, feeUuid: 1 }, { unique: true });
InstituteFeeSchema.index({ tenantId: 1, admissionId: 1 }, { unique: true });
InstituteFeeSchema.index({ ownerUserId: 1, feeUuid: 1 }, { unique: true });
InstituteFeeSchema.index({ tenantId: 1, balance: -1 });

export const InstituteFee =
  (mongoose.models.InstituteFee as any) || mongoose.model('InstituteFee', InstituteFeeSchema);

export default InstituteFee;
