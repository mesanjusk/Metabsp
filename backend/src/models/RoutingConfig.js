const mongoose = require('mongoose');

const routingConfigSchema = new mongoose.Schema(
  {
    phoneNumberId: { type: String, required: true, trim: true },
    appName: { type: String, required: true, trim: true },
    appUrl: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

routingConfigSchema.index({ phoneNumberId: 1 });

module.exports = mongoose.model('RoutingConfig', routingConfigSchema);
