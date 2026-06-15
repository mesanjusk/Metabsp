const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  code:          { type: String, required: true, trim: true },
  purpose:       { type: String, default: '' },
  leadUserId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  memberUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive:      { type: Boolean, default: true },
  tenantId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
}, { timestamps: true });

teamSchema.index({ code: 1, tenantId: 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);
