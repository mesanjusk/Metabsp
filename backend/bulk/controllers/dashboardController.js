const User         = require('../models/User');
const Notification = require('../models/Notification');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const BaileysMessage  = require('../models/BaileysMessage');
const Campaign        = require('../models/Campaign');

exports.getSummary = async (req, res) => {
  try {
    const [users, notifications, waMessages, baileysMessages, campaigns] = await Promise.all([
      User.countDocuments(),
      Notification.countDocuments({ readBy: { $size: 0 } }).catch(() => 0),
      WhatsAppMessage.countDocuments().catch(() => 0),
      BaileysMessage.countDocuments().catch(() => 0),
      Campaign.countDocuments().catch(() => 0),
    ]);

    res.json({
      users,
      notifications,
      whatsappMessages: waMessages + baileysMessages,
      campaigns,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
