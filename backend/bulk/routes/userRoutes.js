const express = require('express');
const {
  getUsers,
  createUser,
  updateUser,
  bulkImportGuests,
  bulkImportVolunteers,
} = require('../controllers/userController');
const { protect, permit } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

const router = express.Router();

router.get('/', protect, getUsers);
router.post('/', protect, permit(PERMISSIONS.users_manage), createUser);
router.post('/bulk-import-guests', protect, permit(PERMISSIONS.users_manage), bulkImportGuests);
router.post('/bulk-import-volunteers', protect, permit(PERMISSIONS.users_manage), bulkImportVolunteers);
router.put('/:id', protect, permit(PERMISSIONS.users_manage), updateUser);

module.exports = router;
