const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', index: true },
    object: { type: String, default: '' },
    entry: { type: mongoose.Schema.Types.Mixed },
    rawBody: { type: String },
    headers: { type: mongoose.Schema.Types.Mixed },
    receivedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

webhookEventSchema.index({ userId: 1, receivedAt: -1 });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
