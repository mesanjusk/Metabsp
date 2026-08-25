const User         = require('../models/User');
const Notification = require('../models/Notification');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const Campaign        = require('../models/Campaign');

exports.getSummary = async (req, res) => {
  try {
    // null tenantId (super admin) sees global counts; everyone else is scoped
    // to their own organization.
    const tenantFilter = req.tenantId ? { tenantId: req.tenantId } : {};
    const [users, notifications, waMessages, campaigns] = await Promise.all([
      User.countDocuments(tenantFilter),
      Notification.countDocuments({ ...tenantFilter, readBy: { $size: 0 } }).catch(() => 0),
      WhatsAppMessage.countDocuments(tenantFilter).catch(() => 0),
      Campaign.countDocuments(req.tenantId ? { userId: req.user._id } : {}).catch(() => 0),
    ]);

    res.json({
      users,
      notifications,
      whatsappMessages: waMessages,
      campaigns,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
