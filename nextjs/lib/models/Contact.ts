import mongoose, { Schema } from 'mongoose';

// Ported from backend/src/repositories/contact.js.
const contactSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    whatsappAccountId: { type: Schema.Types.ObjectId, ref: 'WhatsAppAccount', index: true, default: null },
    phone: { type: String, required: true, trim: true },
    name: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    company: { type: String, default: '', trim: true },
    notes: { type: String, default: '' },
    category: { type: String, default: '', trim: true, index: true },
    tags: { type: [String], default: [] },
    lastMessage: { type: String, default: '' },
    lastSeen: { type: Date, default: null },
    customFields: { type: Schema.Types.Mixed, default: {} },
    assignedAgent: { type: String, default: '', trim: true },
    conversation: {
      lastCustomerMessageAt: { type: Date, default: null },
      windowOpen: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

contactSchema.pre('save', function normalizeContact(next) {
  const doc = this as any;
  doc.phone = String(doc.phone || '').replace(/\D/g, '');
  doc.tags = [...new Set((doc.tags || []).map((tag: string) => String(tag || '').trim().toLowerCase()).filter(Boolean))];
  if (!doc.customFields || typeof doc.customFields !== 'object' || Array.isArray(doc.customFields)) {
    doc.customFields = {};
  }
  next();
});

// NOTE (see docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md §1.4): production Atlas
// may still carry a legacy global unique index on `phone` predating this
// per-user-scoped one — verify/drop it on the shared cluster, not here.
contactSchema.index({ userId: 1, phone: 1 }, { unique: true, sparse: true });
contactSchema.index({ tags: 1 });
contactSchema.index({ lastSeen: -1 });
contactSchema.index({ assignedAgent: 1 });
contactSchema.index({ userId: 1, whatsappAccountId: 1, updatedAt: -1 });

export const Contact = (mongoose.models.Contact as any) || mongoose.model('Contact', contactSchema);
export default Contact;
