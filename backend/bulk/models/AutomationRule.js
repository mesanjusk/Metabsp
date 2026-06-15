const mongoose = require('mongoose');

const automationRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  triggerKey: { type: String, required: true },
  conditionText: { type: String, default: '' },
  templateName: { type: String, default: '' },
  recipientType: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
}, { timestamps: true });

module.exports = mongoose.model('AutomationRule', automationRuleSchema);
