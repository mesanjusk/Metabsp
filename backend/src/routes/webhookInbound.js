const express = require('express');
const crypto = require('crypto');
const Message = require('../repositories/Message');
const Contact = require('../repositories/contact');
const { emitNewMessage } = require('../socket');

const router = express.Router();

const normalizePhone = (v) => String(v || '').replace(/\D/g, '');

// Receives the forwarded "webhook destination" payload from whichever project
// owns the Meta webhook subscription for a shared WhatsApp number (see
// controllers/whatsappController.js#forwardToWebhookDestinations on that side).
// Authenticity is verified with the per-destination secret shown once when the
// destination was created/regenerated there — not with Meta's app secret,
// since this app never talks to Meta directly for this number.
router.post('/', (req, res) => {
  try {
    const secret = String(process.env.WHATSAPP_FORWARD_SECRET || '');
    if (!secret) {
      console.error('[whatsapp-inbound] WHATSAPP_FORWARD_SECRET not configured — rejecting forwarded webhook');
      return res.status(403).send('Webhook forwarding not configured');
    }

    const signature = String(req.headers['x-metabsp-signature-256'] || '');
    if (!signature.startsWith('sha256=') || !req.rawBody) return res.status(403).send('Invalid signature');

    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    const isValid = (() => {
      try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      } catch (_error) {
        return false;
      }
    })();
    if (!isValid) return res.status(403).send('Invalid signature');

    const payload = req.body || {};
    res.status(200).json({ received: true });

    setImmediate(async () => {
      try {
        const saved = await Message.create(payload);
        emitNewMessage(saved.toObject());

        const phone = normalizePhone(payload.from);
        if (phone) {
          await Contact.findOneAndUpdate(
            { phone },
            {
              $setOnInsert: { phone, name: '' },
              $set: {
                lastMessage: payload.message || '',
                lastSeen: payload.timestamp || new Date(),
              },
            },
            { upsert: true }
          );
        }
      } catch (err) {
        console.error('[whatsapp-inbound] processing failed:', err.message);
      }
    });
  } catch (error) {
    console.error('[whatsapp-inbound] webhook error:', error);
    return res.status(200).json({ received: true });
  }
});

module.exports = router;
