const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  displayName: { type: String, default: '' },
  language: { type: String, default: 'en_US' },
  category: { type: String, default: 'UTILITY' },
  bodyText: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
}, { timestamps: true });

module.exports = mongoose.model('WhatsAppTemplate', schema);
