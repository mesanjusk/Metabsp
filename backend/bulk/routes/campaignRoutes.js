const router       = require('express').Router();
const { protect }  = require('../middleware/auth');
const Campaign     = require('../models/Campaign');
const baileysService = require('../services/baileysService');
const BaileysMessage = require('../models/BaileysMessage');

function normalizePhone(v) {
  const d = String(v || '').replace(/[^\d]/g, '').trim();
  return d.length === 10 ? '91' + d : d;
}

// Campaign.userId is the owner (Metabsp-style ownership, not tenant-based —
// Campaign predates/spans both former products). Super-admin (wildcard
// permission) sees everything; everyone else only their own campaigns.
function isSuperAdmin(req) {
  return (req.user?.roleId?.permissions || []).includes('*');
}
function ownershipFilter(req) {
  return isSuperAdmin(req) ? {} : { userId: req.user._id };
}

router.get('/', protect, async (req, res) => {
  try {
    const campaigns = await Campaign.find(ownershipFilter(req)).sort({ createdAt: -1 }).lean();
    res.json(campaigns);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/', protect, async (req, res) => {
  try {
    const campaign = await Campaign.create({ ...req.body, userId: req.user._id });
    res.status(201).json(campaign);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const c = await Campaign.findOne({ _id: req.params.id, ...ownershipFilter(req) }).lean();
    if (!c) return res.status(404).json({ message: 'Not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    const c = await Campaign.findOneAndUpdate({ _id: req.params.id, ...ownershipFilter(req) }, req.body, { new: true });
    if (!c) return res.status(404).json({ message: 'Not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const deleted = await Campaign.findOneAndDelete({ _id: req.params.id, ...ownershipFilter(req) });
    if (!deleted) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/:id/send', protect, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, ...ownershipFilter(req) });
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.status === 'SENDING') return res.status(409).json({ message: 'Already sending' });
    await Campaign.findByIdAndUpdate(campaign._id, { status: 'SENDING' });
    res.json({ message: 'Campaign send started', id: campaign._id });
    const ownerId = campaign.userId ? String(campaign.userId) : String(req.user._id);
    runCampaign(campaign, ownerId).catch(console.error);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Shared by the manual "send now" route above and startScheduler() below.
// Always sends through the campaign owner's own Baileys session (never the
// shared/global session), and logs every send to BaileysMessage for audit.
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
      await BaileysMessage.create({
        to: phone, from: '', contactName: r.name,
        conversationKey: phone,
        direction: 'OUTGOING', source: 'CAMPAIGN',
        messageType: campaign.imageUrl ? 'IMAGE' : 'TEXT',
        bodyText: personalMsg, status: 'SENT',
        meta: { campaignId: campaign._id },
      }).catch(() => null);
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

function startScheduler() {
  setInterval(async () => {
    try {
      const due = await Campaign.find({
        status: 'SCHEDULED', type: 'AUTO', scheduledAt: { $lte: new Date() },
      });
      for (const c of due) {
        await Campaign.findByIdAndUpdate(c._id, { status: 'SENDING' });
        runCampaign(c, c.userId ? String(c.userId) : undefined).catch(console.error);
      }
    } catch (_) {}
  }, 60 * 1000);
}

startScheduler();

module.exports = router;
