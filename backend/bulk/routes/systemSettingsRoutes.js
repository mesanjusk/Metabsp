const express = require('express');
const router = express.Router();
const { protect, permit } = require('../middleware/auth');
const {
  getSettings,
  updateSetting,
  updateSettings,
} = require('../controllers/systemSettingsController');

// Reading global settings only requires being logged in; changing them is
// super-admin only (wildcard permission).
router.get('/', protect, getSettings);
router.put('/', protect, permit('*'), updateSettings);   // bulk update  { key: value, ... }
router.put('/:key', protect, permit('*'), updateSetting); // single key   { value: ... }

module.exports = router;
