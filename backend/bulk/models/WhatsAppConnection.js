const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  mode: { type: String, enum: ['MANUAL','EMBEDDED'], default: 'MANUAL' },
  phoneNumberId: { type: String, default: '' },
  businessAccountId: { type: String, default: '' },
  wabaId: { type: String, default: '' },
  accessTokenMasked: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
}, { timestamps: true });

module.exports = mongoose.model('WhatsAppConnection', schema);
