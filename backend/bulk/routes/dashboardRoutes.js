const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getSummary } = require('../controllers/dashboardController');

router.get('/summary', protect, getSummary);

module.exports = router;
