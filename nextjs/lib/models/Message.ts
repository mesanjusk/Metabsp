import mongoose, { Schema } from 'mongoose';

// Ported from backend/src/repositories/Message.js.
const messageSchema = new Schema(
  {
    fromMe: Boolean,
    from: String,
    to: String,
    message: String,
    body: String,
    timestamp: Date,
    status: String,
    direction: String,
    messageId: String,
    type: String,
    text: String,
    mediaUrl: String,
    mediaId: String,
    // Cloudinary handles, so retention can delete the stored file and not
    // just the row that points at it. Absent on rows written before this.
    mediaPublicId: String,
    mediaResourceType: String,
    caption: String,
    filename: String,
    mimeType: String,
    time: Date,
    customerUuid: String,
    customerId: String,

    // Coexistence provenance — mirrors backend/src/repositories/Message.js.
    // 'coexistence_app' = sent by the business from the WhatsApp Business app
    // (smb_message_echoes); 'coexistence_history' = backfilled from `history`.
    source: { type: String, default: '', index: true },
    isHistorical: { type: Boolean, default: false },

    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    whatsappAccountId: { type: Schema.Types.ObjectId, ref: 'WhatsAppAccount', index: true },

    // A template send stores the words it delivered in `body`/`message`/`text`
    // like any other message; these keep the template it came from, so the
    // thread can render header/body/footer as separate parts and a rendered row
    // is still traceable back to its template.
    templateName: String,
    templateLanguage: String,
    templateParts: Schema.Types.Mixed,

    interactiveType: String,
    replyId: String,
    replyTitle: String,
    flowId: String,
    flowToken: String,
    flowResponseData: Schema.Types.Mixed,
  },
  { timestamps: true }
);

messageSchema.pre('save', function syncLegacyFields(next) {
  const doc = this as any;
  if (typeof doc.fromMe === 'undefined') doc.fromMe = doc.direction === 'outgoing';
  if (!doc.message && doc.body) doc.message = doc.body;
  if (!doc.message && doc.text) doc.message = doc.text;
  if (!doc.message && doc.mediaUrl) doc.message = doc.mediaUrl;
  if (!doc.body && doc.message) doc.body = doc.message;
  if (!doc.body && doc.text) doc.body = doc.text;
  if (!doc.text && doc.body) doc.text = doc.body;
  if (!doc.text && doc.message && doc.type === 'text') doc.text = doc.message;
  if (!doc.timestamp && doc.time) doc.timestamp = doc.time;
  if (!doc.time && doc.timestamp) doc.time = doc.timestamp;
  next();
});

messageSchema.index({ userId: 1, whatsappAccountId: 1, timestamp: -1 });
messageSchema.index({ whatsappAccountId: 1, from: 1, to: 1 });
messageSchema.index({ from: 1 });
messageSchema.index({ to: 1 });
messageSchema.index({ timestamp: 1 });
messageSchema.index({ time: -1 });
messageSchema.index({ messageId: 1 }, { sparse: true });
messageSchema.index({ customerUuid: 1 });
messageSchema.index({ flowId: 1 });
messageSchema.index({ flowToken: 1 });

export const Message = (mongoose.models.Message as any) || mongoose.model('Message', messageSchema);
export default Message;
