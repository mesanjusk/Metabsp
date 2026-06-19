const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', index: true, default: null },
    whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppAccount', index: true, default: null },
    phone:    { type: String, required: true, trim: true },
    name:     { type: String, default: '', trim: true },
    email:    { type: String, default: '', trim: true },
    city:     { type: String, default: '', trim: true },
    state:    { type: String, default: '', trim: true },
    company:  { type: String, default: '', trim: true },
    notes:    { type: String, default: '' },
    category: { type: String, default: '', trim: true, index: true },
    tags:     { type: [String], default: [] },
    lastMessage:  { type: String, default: '' },
    lastSeen:     { type: Date, default: null },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    assignedAgent: { type: String, default: '', trim: true },
    conversation: {
      lastCustomerMessageAt: {
        type: Date,
        default: null,
      },
      windowOpen: {
        type: Boolean,
        default: false,
      },
    },
  },
  { timestamps: true }
);

contactSchema.pre('save', function normalizeContact(next) {
  this.phone = String(this.phone || '').replace(/\D/g, '');

  this.tags = [
    ...new Set(
      (this.tags || [])
        .map((tag) => String(tag || '').trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  if (
    !this.customFields ||
    typeof this.customFields !== 'object' ||
    Array.isArray(this.customFields)
  ) {
    this.customFields = {};
  }

  next();
});

// Unique phone per user (not globally). MongoDB may still have an old global
// unique index from a previous schema — drop it manually if phone conflicts occur:
// db.contacts.dropIndex("phone_1")
contactSchema.index({ userId: 1, phone: 1 }, { unique: true, sparse: true });
contactSchema.index({ tags: 1 });
contactSchema.index({ lastSeen: -1 });
contactSchema.index({ assignedAgent: 1 });

module.exports = mongoose.model('Contact', contactSchema);