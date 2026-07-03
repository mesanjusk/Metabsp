const express = require('express');
const { getRoles, createRole } = require('../controllers/roleController');
const { protect, permit } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');
const router = express.Router();

router.get('/', protect, getRoles);
router.post('/', protect, permit(PERMISSIONS.users_manage), createRole);

module.exports = router;
