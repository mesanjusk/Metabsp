const mongoose = require('mongoose');

const groupContactSchema = new mongoose.Schema({
  name:      { type: String, default: '' },
  mobile:    { type: String, required: true },
  groupId:   { type: String, required: true },
  groupName: { type: String, default: '' },
  isAdmin:   { type: Boolean, default: false },
  tenantId:  { type: mongoose.Schema.Types.ObjectId, default: null },
  source:    { type: String, default: 'WHATSAPP_GROUP' },
}, { timestamps: true });

groupContactSchema.index({ mobile: 1, groupId: 1 }, { unique: true });

module.exports = mongoose.model('GroupContact', groupContactSchema);
