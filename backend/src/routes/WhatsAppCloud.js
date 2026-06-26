const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { enforceWhatsApp24hWindow } = require('../middleware/whatsapp24hGuard');

const {
  getConnectConfig,
  exchangeMetaToken,
  completeConnection,
  manualConnect,
  listAccounts,
  getAccount,
  activateAccount,
  deleteAccount,
  disconnectAccount,
  revalidateAccount,
  updateManualAccount,
  getStatus,
  sendText,
  sendTemplate,
  sendMedia,
  sendMessage,
  sendBroadcast,
  createAutoReplyRule,
  updateAutoReplyRule,
  deleteAutoReplyRule,
  toggleAutoReplyRule,
  getAutoReplyRules,
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  bulkUpdateContacts,
  importContacts,
  getTemplates,
  getMessages,
  getConversations,
  getAnalytics,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  getSettings,
  saveSettings,
} = require('../controllers/whatsappController');

const Campaign = require('../../bulk/models/Campaign');
const baileysService = require('../../bulk/services/baileysService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const messagingLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 30 });

router.get('/connect/config', requireAuth, getConnectConfig);
router.post('/connect/complete', requireAuth, completeConnection);
router.post('/connect/manual', requireAuth, manualConnect);
router.get('/account', requireAuth, getAccount);
router.post('/embedded-signup/exchange-code', requireAuth, exchangeMetaToken);

router.get('/accounts', requireAuth, listAccounts);
router.post('/accounts/:id/activate', requireAuth, activateAccount);
router.post('/account/:id/disconnect', requireAuth, disconnectAccount);
router.post('/account/:id/revalidate', requireAuth, revalidateAccount);
router.put('/account/:id/manual', requireAuth, updateManualAccount);
router.get('/status', requireAuth, getStatus);
router.delete('/accounts/:id', requireAuth, deleteAccount);
router.delete('/account/:id', requireAuth, deleteAccount);

router.post('/send-text', requireAuth, messagingLimiter, enforceWhatsApp24hWindow, sendText);
router.post('/send-template', requireAuth, messagingLimiter, sendTemplate);
router.post('/send-media', requireAuth, messagingLimiter, upload.single('file'), enforceWhatsApp24hWindow, sendMedia);
router.post('/send-message', requireAuth, messagingLimiter, enforceWhatsApp24hWindow, sendMessage);
router.post('/broadcast', requireAuth, messagingLimiter, sendBroadcast);

router.get('/contacts', requireAuth, getContacts);
router.post('/contacts', requireAuth, createContact);
router.patch('/contacts/bulk', requireAuth, bulkUpdateContacts);
router.put('/contacts/:id', requireAuth, updateContact);
router.delete('/contacts/:id', requireAuth, deleteContact);
router.post('/contacts/import', requireAuth, importContacts);

router.post('/auto-reply', requireAuth, createAutoReplyRule);
router.get('/auto-reply', requireAuth, getAutoReplyRules);
router.put('/auto-reply/:id', requireAuth, updateAutoReplyRule);
router.delete('/auto-reply/:id', requireAuth, deleteAutoReplyRule);
router.patch('/auto-reply/:id/toggle', requireAuth, toggleAutoReplyRule);

router.get('/templates', requireAuth, getTemplates);
router.get('/messages', requireAuth, getMessages);
router.get('/conversations', requireAuth, getConversations);
router.get('/analytics', requireAuth, getAnalytics);

// ── Campaigns (per-user scoped) ────────────────────────────────────────────────
router.get('/campaigns', requireAuth, async (req, res) => {
  try {
    const filter = req.user.isAdmin ? {} : { userId: req.user.id };
    const campaigns = await Campaign.find(filter).sort({ createdAt: -1 }).lean();
    res.json(campaigns);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/campaigns', requireAuth, async (req, res) => {
  try {
    const campaign = await Campaign.create({ ...req.body, userId: req.user.id });
    res.status(201).json(campaign);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/campaigns/:id', requireAuth, async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (!req.user.isAdmin) filter.userId = req.user.id;
    const c = await Campaign.findOne(filter).lean();
    if (!c) return res.status(404).json({ message: 'Not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.patch('/campaigns/:id', requireAuth, async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (!req.user.isAdmin) filter.userId = req.user.id;
    const c = await Campaign.findOneAndUpdate(filter, req.body, { new: true });
    if (!c) return res.status(404).json({ message: 'Not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/campaigns/:id', requireAuth, async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (!req.user.isAdmin) filter.userId = req.user.id;
    await Campaign.findOneAndDelete(filter);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/campaigns/:id/send', requireAuth, async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (!req.user.isAdmin) filter.userId = req.user.id;
    const campaign = await Campaign.findOne(filter);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.status === 'SENDING') return res.status(409).json({ message: 'Already sending' });
    await Campaign.findByIdAndUpdate(campaign._id, { status: 'SENDING' });
    res.json({ message: 'Campaign send started', id: campaign._id });
    runCampaign(campaign, req.user.id).catch(console.error);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Account settings (callbackUrl + feature flags) ───────────────────────────
router.get('/settings',  requireAuth, getSettings);
router.post('/settings', requireAuth, saveSettings);

// ── API Key management ────────────────────────────────────────────────────────
router.get('/api-keys',     requireAuth, listApiKeys);
router.post('/api-keys',    requireAuth, createApiKey);
router.delete('/api-keys/:id', requireAuth, revokeApiKey);

// ── Baileys proxy routes (per-user QR / status / send) ───────────────────────
router.get('/baileys/status', requireAuth, (req, res) => {
  try { res.json(baileysService.getStatus(req.user.id)); }
  catch (e) { res.json({ status: 'DISCONNECTED', qr: null, phone: null }); }
});

router.post('/baileys/connect', requireAuth, (req, res) => {
  try {
    baileysService.connect(req.user.id).catch(() => {});
    res.json({ message: 'Connection initiated' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/baileys/disconnect', requireAuth, async (req, res) => {
  try {
    await baileysService.disconnect(req.user.id);
    res.json({ message: 'Disconnected' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/baileys/send-text', requireAuth, async (req, res) => {
  try {
    const { to, body } = req.body;
    await baileysService.sendText(req.user.id, { to, body });
    res.json({ message: 'Sent' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

function normalizePhone(v) {
  const d = String(v || '').replace(/[^\d]/g, '').trim();
  return d.length === 10 ? '91' + d : d;
}

async function runCampaign(campaign, userId) {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const rand  = () => (Math.floor(Math.random() * 9) + 12) * 1000;
  let sent = 0, failed = 0;
  const updatedRecipients = campaign.recipients.map(r => ({ ...r.toObject(), status: 'PENDING' }));
  for (let i = 0; i < updatedRecipients.length; i++) {
    const r = updatedRecipients[i];
    const phone = normalizePhone(r.mobile);
    const personalMsg = (campaign.message || '').replace(/\{name\}/gi, r.name);
    try {
      if (campaign.imageUrl) {
        await baileysService.sendImage(userId, { to: phone, imageUrl: campaign.imageUrl, caption: personalMsg });
      } else {
        await baileysService.sendText(userId, { to: phone, body: personalMsg });
      }
      updatedRecipients[i].status = 'SENT';
      updatedRecipients[i].sentAt = new Date();
      sent++;
    } catch (err) {
      updatedRecipients[i].status = 'FAILED';
      updatedRecipients[i].error  = err.message;
      failed++;
    }
    if (i < updatedRecipients.length - 1) await sleep(rand());
  }
  await Campaign.findByIdAndUpdate(campaign._id, {
    status: 'SENT', sentCount: sent, failedCount: failed, recipients: updatedRecipients,
  });
}

module.exports = router;
