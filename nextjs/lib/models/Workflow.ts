import mongoose, { Schema } from 'mongoose';

// Ported from backend/src/repositories/Workflow.js.
const workflowStepSchema = new Schema(
  {
    delaySeconds: { type: Number, min: 0, max: 3600, default: 0 },
    replyType: { type: String, enum: ['text', 'template'], default: 'text' },
    reply: { type: String, trim: true, required: true },
    templateLanguage: { type: String, default: 'en_US' },
  },
  { _id: false }
);

const workflowSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    whatsappAccountId: { type: Schema.Types.ObjectId, ref: 'WhatsAppAccount', index: true },
    name: { type: String, required: true, trim: true },
    keyword: { type: String, required: true, trim: true, lowercase: true },
    matchType: { type: String, enum: ['exact', 'contains', 'starts_with'], default: 'contains' },
    isActive: { type: Boolean, default: true },
    steps: {
      type: [workflowStepSchema],
      default: [],
      validate: {
        validator: (steps: unknown[]) => Array.isArray(steps) && steps.length > 0 && steps.length <= 10,
        message: 'A workflow needs between 1 and 10 steps',
      },
    },
  },
  { timestamps: true }
);

workflowSchema.index({ userId: 1, whatsappAccountId: 1, isActive: 1 });

export const Workflow = (mongoose.models.Workflow as any) || mongoose.model('Workflow', workflowSchema);
export default Workflow;
