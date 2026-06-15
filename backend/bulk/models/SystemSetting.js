const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    key:         { type: String, required: true, trim: true },
    value:       { type: mongoose.Schema.Types.Mixed, required: true },
    label:       { type: String, default: '' },
    description: { type: String, default: '' },
    tenantId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  },
  { timestamps: true }
);

systemSettingSchema.index({ key: 1, tenantId: 1 }, { unique: true });

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
