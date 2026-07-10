const express = require('express');
const {
  checkMobile,
  requestSignupOtp,
  verifySignupOtp,
  requestForgotOtp,
  resetPassword,
  listOrgs,
  setBaileysEnabled,
} = require('../controllers/orgController');
const { protect, permit } = require('../middleware/auth');

const router = express.Router();

// Public — no auth needed
router.post('/check-mobile',          checkMobile);
router.post('/request-signup-otp',    requestSignupOtp);
router.post('/verify-signup-otp',     verifySignupOtp);
router.post('/request-forgot-otp',    requestForgotOtp);
router.post('/reset-password',        resetPassword);

// Protected — super admin only (wildcard permission)
router.get('/', protect, permit('*'), listOrgs);
router.patch('/:id/baileys', protect, permit('*'), setBaileysEnabled);

module.exports = router;
