const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { requireBaileysEnabled } = require('../middleware/baileysGate');
const {
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
} = require('../controllers/baileysController');

// Status & connection management
router.get('/status',      protect, requireBaileysEnabled, getStatus);
router.post('/connect',    protect, requireBaileysEnabled, startConnection);
router.post('/disconnect', protect, requireBaileysEnabled, stopConnection);

// Inbox & conversations
router.get('/inbox',                               protect, requireBaileysEnabled, getInbox);
router.get('/conversation/:conversationKey',       protect, requireBaileysEnabled, getConversation);
router.post('/conversation/:conversationKey/read', protect, requireBaileysEnabled, markConversationRead);

// Send
router.post('/send-text',   protect, requireBaileysEnabled, sendText);
router.post('/send-invite', protect, requireBaileysEnabled, sendInvitation);

// Logs
router.get('/logs', protect, requireBaileysEnabled, getLogs);

// Auto-reply rules
router.get('/rules',     protect, requireBaileysEnabled, getRules);
router.post('/rules',    protect, requireBaileysEnabled, saveRule);
router.put('/rules/:id', protect, requireBaileysEnabled, saveRule);

// Group members
router.get('/groups',         protect, requireBaileysEnabled, getGroupsWithMembers);
router.post('/groups/import', protect, requireBaileysEnabled, importGroupContacts);

module.exports = router;
