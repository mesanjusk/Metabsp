// Parsing for inbound WhatsApp webhook payloads.
//
// This module used to also own outbound "webhook destinations" — HMAC-signed
// fan-out of inbound messages and contact events to a customer's own systems,
// plus keyword-based routing that pinned a conversation to one destination.
// All of it is gone: the feature was never used, and a normal BSP does not
// re-broadcast a customer's WhatsApp traffic to arbitrary third-party URLs.
//
// Inbound messages are still fully processed — persisted, contacts upserted,
// media stored, auto-replies and workflows matched. They simply are not
// forwarded anywhere else.

export const parseIncoming = (msg: any = {}) => {
  const type = String(msg.type || 'text').toLowerCase();
  if (type === 'text') return { type, message: String(msg.text?.body || ''), mediaId: '' };
  if (['image', 'video', 'audio', 'sticker', 'document'].includes(type)) {
    const mediaNode = msg[type] || {};
    return { type, message: String(mediaNode.caption || mediaNode.id || ''), mediaId: String(mediaNode.id || '') };
  }
  if (type === 'interactive') {
    const iType = msg.interactive?.type;
    let interactiveId = '';
    let text = '';
    if (iType === 'button_reply') {
      interactiveId = msg.interactive.button_reply?.id || '';
      text = msg.interactive.button_reply?.title || '';
    } else if (iType === 'list_reply') {
      interactiveId = msg.interactive.list_reply?.id || '';
      text = msg.interactive.list_reply?.title || '';
    } else {
      interactiveId = JSON.stringify(msg.interactive || {});
    }
    return { type, message: text || interactiveId, mediaId: '', interactiveId };
  }
  if (type === 'button') {
    const interactiveId = msg.button?.payload || '';
    return { type, message: msg.button?.text || interactiveId, mediaId: '', interactiveId };
  }
  return null;
};
