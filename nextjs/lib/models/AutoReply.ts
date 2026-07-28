import mongoose, { Schema } from 'mongoose';

// Ported from backend/src/repositories/AutoReply.js.
const autoReplySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    whatsappAccountId: { type: Schema.Types.ObjectId, ref: 'WhatsAppAccount', index: true },
    keyword: {
      type: String,
      trim: true,
      lowercase: true,
      required(this: any) {
        return String(this.ruleType || 'keyword') !== 'ai_assistant';
      },
    },
    matchType: { type: String, enum: ['exact', 'contains', 'starts_with'], default: 'contains' },
    replyType: { type: String, enum: ['text', 'template'], default: 'text' },
    ruleType: { type: String, enum: ['keyword', 'product_catalog', 'ai_assistant'], default: 'keyword', index: true },
    reply: {
      type: String,
      trim: true,
      default: '',
      required(this: any) {
        return !['product_catalog', 'ai_assistant'].includes(String(this.ruleType || 'keyword'));
      },
    },
    templateLanguage: { type: String, default: 'en_US' },
    aiSystemPrompt: { type: String, trim: true, default: '' },
    aiModel: { type: String, trim: true, default: '' },
    catalogRows: { type: [Schema.Types.Mixed], default: [] },
    catalogConfig: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    delaySeconds: { type: Number, min: 0, max: 30, default: null },
  },
  { timestamps: true, collection: 'autoReplies' }
);

autoReplySchema.index({ userId: 1, whatsappAccountId: 1, isActive: 1, keyword: 1, matchType: 1 });
autoReplySchema.index({ userId: 1, whatsappAccountId: 1, ruleType: 1, isActive: 1 });

export const AutoReply = (mongoose.models.AutoReply as any) || mongoose.model('AutoReply', autoReplySchema);
export default AutoReply;
