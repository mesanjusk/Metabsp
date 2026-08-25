const express = require('express');
const multer = require('multer');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { runPreflightChecks } = require('../services/preflightCheckService');
const { createRateLimiter } = require('../middleware/rateLimit');
const { enforceWhatsApp24hWindow } = require('../middleware/whatsapp24hGuard');

const {
  getMetaWebhookConfig,
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
  setSystemUserToken,
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
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflow,
  getWorkflows,
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  bulkUpdateContacts,
  importContacts,
  getTemplates,
  createTemplate,
  getMessages,
  getConversations,
  assignConversation,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  getAnalytics,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  getSettings,
  saveSettings,
} = require('../controllers/whatsappController');

const Campaign = require('../../bulk/models/Campaign');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const messagingLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 30 });
// OAuth/connect endpoints call out to Meta's Graph API on every request and
// aren't something a legitimate user does repeatedly in a short window —
// tighter than messagingLimiter to curb abuse and avoid burning through
// Meta's own per-app API rate limits.
const connectLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, maxRequests: 10 });

router.get('/meta-webhook-config', requireAuth, requireAdmin, getMetaWebhookConfig);
// Read-only configuration audit: webhook field subscriptions, coexistence
// gating, and per-account token posture. Admin-only because it reports which
// numbers are connected and how their tokens are held. Rate-limited like the
// other Graph-calling endpoints — `?wabas=true` costs one Graph call per
// active WABA (see services/preflightCheckService.js).
router.get('/preflight', requireAuth, requireAdmin, connectLimiter, async (req, res) => {
  try {
    const includeWabaSubscriptions = String(req.query.wabas || '').toLowerCase() === 'true';
    const report = await runPreflightChecks({ includeWabaSubscriptions });
    // 200 regardless of findings — this is a report, not a liveness probe, and
    // a monitoring tool should key off `severity`, not the HTTP status.
    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/connect/config', requireAuth, getConnectConfig);
router.post('/connect/complete', requireAuth, connectLimiter, completeConnection);
router.post('/connect/manual', requireAuth, connectLimiter, manualConnect);
router.get('/account', requireAuth, getAccount);
router.post('/embedded-signup/exchange-code', requireAuth, connectLimiter, exchangeMetaToken);

router.get('/accounts', requireAuth, listAccounts);
router.post('/accounts/:id/activate', requireAuth, activateAccount);
router.post('/account/:id/disconnect', requireAuth, disconnectAccount);
router.post('/account/:id/revalidate', requireAuth, revalidateAccount);
router.put('/account/:id/system-user-token', requireAuth, connectLimiter, setSystemUserToken);
router.put('/account/:id/manual', requireAuth, connectLimiter, updateManualAccount);
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

router.post('/workflows', requireAuth, createWorkflow);
router.get('/workflows', requireAuth, getWorkflows);
router.put('/workflows/:id', requireAuth, updateWorkflow);
router.delete('/workflows/:id', requireAuth, deleteWorkflow);
router.patch('/workflows/:id/toggle', requireAuth, toggleWorkflow);

router.get('/templates', requireAuth, getTemplates);
router.post('/templates', requireAuth, messagingLimiter, createTemplate);
router.get('/messages', requireAuth, getMessages);
router.get('/conversations', requireAuth, getConversations);
router.put('/conversations/:phone/assign', requireAuth, assignConversation);
router.get('/analytics', requireAuth, getAnalytics);

// ── Shared team inbox (owner-managed) ────────────────────────────────────────
router.get('/accounts/:id/team-members', requireAuth, getTeamMembers);
router.post('/accounts/:id/team-members', requireAuth, addTeamMember);
router.delete('/accounts/:id/team-members/:memberId', requireAuth, removeTeamMember);

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

    // Campaign sending previously ran over Baileys, blasting free-form text to
    // a recipient list. The official Cloud API cannot do that: outside the
    // 24-hour customer service window only an approved template may be sent.
    // The endpoint is kept so existing clients get an explanatory error rather
    // than a 404, and are directed at the supported path.
    return res.status(501).json({
      success: false,
      message:
        'Campaign sending now goes through the WhatsApp Cloud API broadcast endpoint, which requires an approved message template. Use POST /api/whatsapp/broadcast with a template name.',
      campaignId: String(campaign._id),
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Account settings (callbackUrl + feature flags) ───────────────────────────
router.get('/settings',  requireAuth, getSettings);
router.post('/settings', requireAuth, saveSettings);

// ── API Key management ────────────────────────────────────────────────────────
router.get('/api-keys',     requireAuth, listApiKeys);
router.post('/api-keys',    requireAuth, createApiKey);
router.delete('/api-keys/:id', requireAuth, revokeApiKey);

module.exports = router;
