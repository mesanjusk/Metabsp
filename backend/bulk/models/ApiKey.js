const mongoose = require('mongoose');
const crypto   = require('crypto');

const schema = new mongoose.Schema({
  key:        { type: String, required: true, unique: true, index: true },
  userId:     { type: String, required: true, index: true },
  name:       { type: String, default: 'Default', trim: true },
  isActive:   { type: Boolean, default: true, index: true },
  lastUsedAt: { type: Date, default: null },
}, { timestamps: true });

schema.statics.generate = function (userId, name = 'Default') {
  const key = 'mbsp_' + crypto.randomBytes(28).toString('hex');
  return this.create({ key, userId, name });
};

module.exports = mongoose.model('ApiKey', schema);
