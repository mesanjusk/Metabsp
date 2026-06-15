const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  code:         { type: String, required: true, trim: true },
  description:  { type: String, default: '' },
  permissions:  { type: [String], default: [] },
  dashboardKey: { type: String, default: 'default' },
  isActive:     { type: Boolean, default: true },
  tenantId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
}, { timestamps: true });

// code must be unique per tenant (null tenantId = global/super-admin roles)
roleSchema.index({ code: 1, tenantId: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);
