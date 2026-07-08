const mongoose = require('mongoose');

// A minimal, real workflow builder: an ordered sequence of send-message
// steps triggered by the same keyword-match vocabulary AutoReply already
// uses (see src/repositories/AutoReply.js) so the existing matching logic
// (middleware/autoReply.js:matchAutoReplyRule) can be reused as-is. This is
// deliberately not a branching/visual-canvas engine — see
// src/services/workflowService.js for the scope note.
const workflowStepSchema = new mongoose.Schema(
  {
    delaySeconds: { type: Number, min: 0, max: 3600, default: 0 },
    replyType: { type: String, enum: ['text', 'template'], default: 'text' },
    reply: { type: String, trim: true, required: true },
    templateLanguage: { type: String, default: 'en_US' },
  },
  { _id: false }
);

const workflowSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppAccount', index: true },
    name: { type: String, required: true, trim: true },
    keyword: { type: String, required: true, trim: true, lowercase: true },
    matchType: { type: String, enum: ['exact', 'contains', 'starts_with'], default: 'contains' },
    isActive: { type: Boolean, default: true },
    steps: {
      type: [workflowStepSchema],
      default: [],
      validate: {
        validator: (steps) => Array.isArray(steps) && steps.length > 0 && steps.length <= 10,
        message: 'A workflow needs between 1 and 10 steps',
      },
    },
  },
  { timestamps: true }
);

workflowSchema.index({ userId: 1, whatsappAccountId: 1, isActive: 1 });

module.exports = mongoose.model('Workflow', workflowSchema);
