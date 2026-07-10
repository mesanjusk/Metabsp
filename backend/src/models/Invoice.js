const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
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

// Serves GET /api/billing/invoices (routes/billing.js), which queries
// exactly {tenantId} sorted by {createdAt: -1} — the field-level tenantId
// index alone would need a separate in-memory sort stage at any real
// invoice volume.
invoiceSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
