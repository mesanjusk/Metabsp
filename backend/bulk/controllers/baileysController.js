const BaileysMessage = require('../models/BaileysMessage');
const BaileysRule    = require('../models/WhatsAppAutoReplyRule'); // reuse same schema
const Notification   = require('../models/Notification');
const GroupContact   = require('../models/GroupContact');
const { emitEvent }  = require('../services/socket');
const baileysService = require('../services/baileysService');

function normalizePhone(value) {
  const d = String(value || '').replace(/[^\d]/g, '').trim();
  return d.length === 10 ? '91' + d : d;
}
function getConversationKey(phone) {
  return normalizePhone(phone);
}

// ── Status & QR ───────────────────────────────────────────────────────────────

async function getStatus(req, res) {
  res.json(baileysService.getStatus());
}

async function startConnection(req, res) {
  try {
    console.log('[baileys] /connect hit — starting connection');
    await baileysService.connect();
    res.json({ message: 'Baileys connecting…', status: baileysService.getStatus() });
  } catch (error) {
    console.error('[baileys] startConnection error:', error.message);
    res.status(500).json({ message: error.message });
  }
}

async function stopConnection(req, res) {
  try {
    await baileysService.disconnect();
    res.json({ message: 'Baileys disconnected' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// ── Inbox ─────────────────────────────────────────────────────────────────────

async function getInbox(req, res) {
  const messages = await BaileysMessage.find({ conversationKey: { $ne: '' } })
    .sort({ createdAt: -1 })
    .limit(400)
    .lean();

  const grouped = new Map();
  for (const item of messages) {
    const key = item.conversationKey || getConversationKey(item.from || item.to);
    if (!key) continue;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        conversationKey: key,
        phone: key,
        contactName: item.contactName || '',
        lastMessage: item.bodyText || item.messageType,
        lastMessageAt: item.createdAt,
        lastDirection: item.direction,
        unreadCount: item.direction === 'INCOMING' && item.status !== 'READ' ? 1 : 0,
        lastStatus: item.status,
        messages: 1,
        provider: 'baileys',
      });
    } else {
      current.unreadCount += item.direction === 'INCOMING' && item.status !== 'READ' ? 1 : 0;
      current.messages += 1;
      if (!current.contactName && item.contactName) current.contactName = item.contactName;
    }
  }

  res.json(
    Array.from(grouped.values()).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
  );
}

async function getConversation(req, res) {
  const conversationKey = getConversationKey(req.params.conversationKey);
  const rows = await BaileysMessage.find({ conversationKey }).sort({ createdAt: 1 }).lean();
  res.json(rows);
}

async function markConversationRead(req, res) {
  const conversationKey = getConversationKey(req.params.conversationKey);
  await BaileysMessage.updateMany(
    { conversationKey, direction: 'INCOMING', status: { $in: ['RECEIVED', 'DELIVERED'] } },
    { $set: { status: 'READ' } }
  );
  res.json({ message: 'Marked as read' });
}

// ── Send Text ──────────────────────────────────────────────────────────────────

async function sendText(req, res) {
  const { to, text, contactName = '', replyToMessageId = '' } = req.body;
  if (!to || !text) return res.status(400).json({ message: 'to and text are required' });

  try {
    const result = await baileysService.sendText({ to, body: text });
    const log = await BaileysMessage.create({
      to: normalizePhone(to),
      from: '',
      contactName,
      conversationKey: getConversationKey(to),
      baileysMessageId: result?.key?.id || '',
      replyToMessageId,
      direction: 'OUTGOING',
      source: 'MANUAL',
      messageType: 'TEXT',
      bodyText: text,
      status: 'SENT',
      meta: result || {},
    });
    emitEvent('baileys_message_logged', log);
    return res.status(201).json(log);
  } catch (error) {
    const log = await BaileysMessage.create({
      to: normalizePhone(to),
      contactName,
      conversationKey: getConversationKey(to),
      direction: 'OUTGOING',
      source: 'MANUAL',
      messageType: 'TEXT',
      bodyText: text,
      status: 'FAILED',
      meta: { error: error.message },
    });
    return res.status(500).json(log);
  }
}

// ── Logs (flat list of all messages) ─────────────────────────────────────────

async function getLogs(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const logs = await BaileysMessage.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// ── Send Invitation (image blast) ─────────────────────────────────────────────

async function sendInvitation(req, res) {
  const {
    imageUrl    = '',
    message     = '',
    textPosition = 'bottom',
    recipients  = [],
    includeRsvp = false,
    rsvpYesLabel = 'Yes, I\'ll attend ✅',
    rsvpNoLabel  = 'Sorry, can\'t make it ❌',
  } = req.body;

  if (!recipients.length) return res.status(400).json({ message: 'At least one recipient is required' });

  const caption = message.trim();
  if (!imageUrl && !caption) {
    return res.status(400).json({ message: 'Provide a message or upload an image (or both)' });
  }

  let success = 0;
  let failed  = 0;
  const errors = [];

  for (const recipient of recipients) {
    const phone = normalizePhone(recipient.mobile || recipient.phone || '');
    if (!phone) { failed++; continue; }

    const msgType = imageUrl ? 'IMAGE' : 'TEXT';

    try {
      const recipientName = (recipient.name || '').trim();

      // Build the RSVP suffix that gets embedded directly in the message body
      const rsvpSuffix = includeRsvp
        ? `\n\nPlease confirm your attendance:\n\n✅ Reply *${rsvpYesLabel}*\n❌ Reply *${rsvpNoLabel}*`
        : '';

      if (imageUrl) {
        const fullCaption = caption + rsvpSuffix;
        await baileysService.sendImage({ to: phone, imageUrl, caption: fullCaption });
      } else {
        const greeting = recipientName
          ? `📩 *Dear ${recipientName},*\n\n${caption}`
          : `📩 *Invitation*\n\n${caption}`;
        await baileysService.sendText({ to: phone, body: greeting + rsvpSuffix });
      }

      await BaileysMessage.create({
        to: phone,
        from: '',
        contactName: recipient.name || '',
        conversationKey: getConversationKey(phone),
        direction: 'OUTGOING',
        source: 'INVITATION',
        messageType: msgType,
        bodyText: caption + rsvpSuffix,
        status: 'SENT',
        meta: { imageUrl, textPosition, includeRsvp },
      });

      // Also attempt a native interactive poll as a bonus second message
      if (includeRsvp) {
        const pollQuestion = recipientName
          ? `Will you be attending, ${recipientName}? 🎉`
          : 'Will you be attending? 🎉';
        baileysService.sendButtonMessage({
          to: phone,
          text: pollQuestion,
          footer: '',
          buttons: [
            { id: 'rsvp_yes', label: rsvpYesLabel },
            { id: 'rsvp_no',  label: rsvpNoLabel  },
          ],
        }).then(() =>
          BaileysMessage.create({
            to: phone, from: '', contactName: recipient.name || '',
            conversationKey: getConversationKey(phone),
            direction: 'OUTGOING', source: 'INVITATION', messageType: 'INTERACTIVE',
            bodyText: `📊 Poll: ${rsvpYesLabel} / ${rsvpNoLabel}`, status: 'SENT',
            meta: { rsvp: true, rsvpYesLabel, rsvpNoLabel },
          }).catch(() => null)
        ).catch(err => console.warn('[baileys] native poll skipped:', err.message));
      }

      success++;
    } catch (err) {
      failed++;
      errors.push({ phone, error: err.message });

      await BaileysMessage.create({
        to: phone,
        contactName: recipient.name || '',
        conversationKey: getConversationKey(phone),
        direction: 'OUTGOING',
        source: 'INVITATION',
        messageType: msgType,
        bodyText: caption,
        status: 'FAILED',
        meta: { error: err.message },
      }).catch(() => null);
    }
  }

  res.json({
    message: `Invitation sent: ${success} success, ${failed} failed`,
    total: recipients.length,
    success,
    failed,
    errors,
  });
}

// ── Group Members ─────────────────────────────────────────────────────────────

async function getGroupsWithMembers(req, res) {
  try {
    const userId = req.user?._id?.toString() || '_global_';
    const groups = await baileysService.getGroupsWithMembers(userId);
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function importGroupContacts(req, res) {
  try {
    const { contacts } = req.body;
    if (!Array.isArray(contacts) || !contacts.length) {
      return res.status(400).json({ message: 'contacts array is required' });
    }
    const tenantId = req.user?.tenantId || null;
    let imported = 0;
    let skipped  = 0;
    for (const c of contacts) {
      if (!c.mobile || !c.groupId) { skipped++; continue; }
      try {
        await GroupContact.findOneAndUpdate(
          { mobile: c.mobile, groupId: c.groupId },
          { $set: { name: c.name || '', groupName: c.groupName || '', isAdmin: !!c.isAdmin, tenantId, source: 'WHATSAPP_GROUP' } },
          { upsert: true }
        );
        imported++;
      } catch (_) {
        skipped++;
      }
    }
    res.json({ message: `Imported ${imported} contacts, skipped ${skipped}`, imported, skipped });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// ── Auto-reply rules ──────────────────────────────────────────────────────────

async function getRules(req, res) {
  try {
    const rules = await BaileysRule.find().sort({ priority: 1, createdAt: -1 }).lean();
    res.json(rules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function saveRule(req, res) {
  try {
    const { id } = req.params;
    let rule;
    if (id) {
      rule = await BaileysRule.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
      if (!rule) return res.status(404).json({ message: 'Rule not found' });
    } else {
      rule = await BaileysRule.create(req.body);
    }
    res.json(rule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// ── Auto-reply for Baileys incoming messages ──────────────────────────────────

async function runBaileysAutoReply({ from, body, userId }) {
  const incomingText = String(body || '').trim().toLowerCase();
  if (!incomingText) return;

  const rules = await BaileysRule.find({ isActive: true }).sort({ priority: 1, createdAt: -1 }).lean();
  console.log(`[baileys:autoReply] "${incomingText}" against ${rules.length} rules, userId=${userId}`);

  for (const rule of rules) {
    const trigger = String(rule.triggerText || '').trim().toLowerCase();
    const matched =
      rule.matchType === 'ALL' ? true :
      rule.matchType === 'EXACT' ? incomingText === trigger :
      rule.matchType === 'STARTS_WITH' ? incomingText.startsWith(trigger) :
      incomingText.includes(trigger);

    if (!matched) continue;

    console.log(`[baileys:autoReply] matched rule "${rule.name}" (${rule.matchType})`);

    try {
      if (rule.replyType === 'TEXT' && rule.replyText) {
        await baileysService.sendText(userId, { to: from, body: rule.replyText });
        console.log(`[baileys:autoReply] sent reply to ${from}`);
      }
    } catch (err) {
      console.error(`[baileys:autoReply] send failed:`, err.message);
    }

    if (rule.stopAfterMatch !== false) break;
  }
}

// ── Incoming (called from baileysService event) ───────────────────────────────

async function saveIncomingMessage({ id, from, body, type, raw, userId }) {
  const existing = id
    ? await BaileysMessage.findOne({ baileysMessageId: id })
    : null;
  if (existing) return existing;

  const created = await BaileysMessage.create({
    to: '',
    from: normalizePhone(from),
    conversationKey: getConversationKey(from),
    baileysMessageId: id || '',
    direction: 'INCOMING',
    source: 'WEBHOOK',
    messageType: String(type || 'TEXT').toUpperCase(),
    bodyText: body || '',
    status: 'RECEIVED',
    meta: raw || {},
  });

  emitEvent('baileys_message_logged', created);
  emitEvent('baileys_incoming_message', created);

  await Notification.create({
    title: 'New Baileys WhatsApp message',
    message: `${from} sent a new message`,
    type: 'WHATSAPP',
    targetRoles: ['ADMIN', 'SENIOR_TEAM'],
  }).catch(() => null);

  if (String(type || '').toLowerCase() === 'text' && body) {
    runBaileysAutoReply({ from: normalizePhone(from), body, userId }).catch((err) =>
      console.error('[baileys:autoReply] error:', err.message)
    );
  }

  return created;
}

// Wire up incoming messages from the service layer
const socket = require('../services/socket');
(function wireIncoming() {
  if (!global._baileysIncomingWired) {
    global._baileysIncomingWired = true;
    const origEmit = socket.emitEvent;
    socket.emitEvent = function (event, data) {
      if (event === 'baileys_incoming_message') {
        saveIncomingMessage(data).catch(console.error);
      }
      return origEmit(event, data);
    };
  }
})();

module.exports = {
  getStatus,
  startConnection,
  stopConnection,
  getInbox,
  getConversation,
  markConversationRead,
  sendText,
  getLogs,
  sendInvitation,
  getRules,
  saveRule,
  getGroupsWithMembers,
  importGroupContacts,
};
