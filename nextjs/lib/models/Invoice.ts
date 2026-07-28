import mongoose, { Schema } from 'mongoose';

// Ported from backend/src/models/Invoice.js.
const invoiceSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    planAmountInPaise: { type: Number, required: true, min: 0 },
    overageMessageCount: { type: Number, default: 0, min: 0 },
    overageAmountInPaise: { type: Number, default: 0, min: 0 },
    totalAmountInPaise: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'void'], default: 'pending', index: true },
    gatewayPaymentId: { type: String, default: '', trim: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

invoiceSchema.index({ tenantId: 1, createdAt: -1 });

export const Invoice = (mongoose.models.Invoice as any) || mongoose.model('Invoice', invoiceSchema);
export default Invoice;
