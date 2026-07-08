const router = require('express').Router();
const { login, me, magicLogin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { createAuthRateLimiter } = require('../../src/middleware/rateLimit');

const loginLimiter = createAuthRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 20 });
const magicLoginLimiter = createAuthRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 10 });

router.post('/login', loginLimiter, login);
router.get('/magic-login', magicLoginLimiter, magicLogin);
router.get('/me', protect, me);

module.exports = router;
