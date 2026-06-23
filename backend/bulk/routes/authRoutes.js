const router = require('express').Router();
const { login, me, magicLogin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.get('/magic-login', magicLogin);
router.get('/me', protect, me);

module.exports = router;
