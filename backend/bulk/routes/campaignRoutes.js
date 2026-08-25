/**
 * Campaign CRUD.
 *
 * Sending previously ran over an unofficial WhatsApp Web session, which is how
 * a campaign could blast free-form text to an arbitrary recipient list. The
 * official Cloud API does not permit that: outside Meta's 24-hour customer
 * service window only an approved template may be sent, and delivery is rate
 * limited per number.
 *
 * So the records stay (they hold real customer data and history) but sending
 * moves to POST /api/whatsapp/broadcast, which enqueues per-recipient template
 * jobs through BullMQ. The send routes below return an explanatory 501 rather
 * than 404 so existing clients get a reason, not a mystery.
 */

const router      = require('express').Router();
const { protect } = require('../middleware/auth');
const Campaign    = require('../models/Campaign');

// Campaign.userId is the owner (Metabsp-style ownership, not tenant-based —
// Campaign predates/spans both former products). Super-admin (wildcard
// permission) sees everything; everyone else only their own campaigns.
function isSuperAdmin(req) {
  return (req.user?.roleId?.permissions || []).includes('*');
}
function ownershipFilter(req) {
  return isSuperAdmin(req) ? {} : { userId: req.user._id };
}

const BROADCAST_MIGRATION_NOTICE = {
  success: false,
  message:
    'Campaign sending has moved to the WhatsApp Cloud API broadcast endpoint, which requires an approved message template. Use POST /api/whatsapp/broadcast.',
};

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

// Ownership is still checked before answering, so this cannot be used to probe
// for campaign IDs belonging to another user.
router.post('/:id/send', protect, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, ...ownershipFilter(req) }).lean();
    if (!campaign) return res.status(404).json({ message: 'Not found' });
    return res.status(501).json({ ...BROADCAST_MIGRATION_NOTICE, campaignId: String(campaign._id) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// The 60-second poller that fired SCHEDULED/AUTO campaigns is gone with the
// sending path it drove. Scheduled campaigns are left untouched in the
// database rather than cancelled, so no customer data is destroyed by the
// migration; they simply do not fire until rebuilt on the broadcast queue.

module.exports = router;
