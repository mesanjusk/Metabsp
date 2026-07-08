const mongoose = require('mongoose');

const autoReplySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    whatsappAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppAccount', index: true },
    keyword: {
      type: String,
      trim: true,
      lowercase: true,
      required() {
        return String(this.ruleType || 'keyword') !== 'ai_assistant';
      },
    },

    matchType: {
      type: String,
      enum: ['exact', 'contains', 'starts_with'], // ✅ added
      default: 'contains',
    },

    replyType: {
      type: String,
      enum: ['text', 'template'],
      default: 'text',
    },

    ruleType: {
      type: String,
      enum: ['keyword', 'product_catalog', 'ai_assistant'],
      default: 'keyword',
      index: true,
    },

    reply: {
      type: String,
      trim: true,
      default: '',
      required() {
        return !['product_catalog', 'ai_assistant'].includes(String(this.ruleType || 'keyword'));
      },
    },

    // for template replies
    templateLanguage: {
      type: String,
      default: 'en_US',
    },

    // for ruleType: 'ai_assistant' — a per-rule persona/instructions and an
    // optional model override (e.g. a cheaper model for high-volume replies)
    aiSystemPrompt: {
      type: String,
      trim: true,
      default: '',
    },

    aiModel: {
      type: String,
      trim: true,
      default: '',
    },

    catalogRows: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    catalogConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    delaySeconds: {
      type: Number,
      min: 0,
      max: 30,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'autoReplies',
  }
);

// index for faster lookup
autoReplySchema.index({ userId: 1, whatsappAccountId: 1, isActive: 1, keyword: 1, matchType: 1 });
autoReplySchema.index({ userId: 1, whatsappAccountId: 1, ruleType: 1, isActive: 1 });

module.exports = mongoose.model('AutoReply', autoReplySchema);