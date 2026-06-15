const express = require('express');
const { protect } = require('../middleware/auth');

module.exports = function crudRoutes(Model, populate = '') {
  const router = express.Router();

  // tenantId filter helper — null means super admin (no filter)
  function tenantFilter(req) {
    return req.tenantId ? { tenantId: req.tenantId } : {};
  }

  router.get('/', protect, async (req, res) => {
    try {
      let query = Model.find(tenantFilter(req)).sort({ createdAt: -1 });
      if (populate) query = query.populate(populate);
      res.json(await query);
    } catch (err) {
      res.status(500).json({ message: err.message || 'Failed to fetch records' });
    }
  });

  router.get('/:id', protect, async (req, res) => {
    try {
      let query = Model.findOne({ _id: req.params.id, ...tenantFilter(req) });
      if (populate) query = query.populate(populate);
      const doc = await query;
      if (!doc) return res.status(404).json({ message: 'Record not found' });
      res.json(doc);
    } catch (err) {
      res.status(500).json({ message: err.message || 'Failed to fetch record' });
    }
  });

  router.post('/', protect, async (req, res) => {
    try {
      const payload = { ...req.body };
      if (req.tenantId) payload.tenantId = req.tenantId; // auto-tag with tenant
      const created = await Model.create(payload);
      let query = Model.findById(created._id);
      if (populate) query = query.populate(populate);
      res.status(201).json(await query);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          message: `Duplicate value for ${Object.keys(err.keyPattern || {}).join(', ') || 'unique field'}`,
        });
      }
      res.status(500).json({ message: err.message || 'Failed to create record' });
    }
  });

  router.put('/:id', protect, async (req, res) => {
    try {
      const updated = await Model.findOneAndUpdate(
        { _id: req.params.id, ...tenantFilter(req) },
        req.body,
        { new: true, runValidators: true }
      );
      if (!updated) return res.status(404).json({ message: 'Record not found' });
      let query = Model.findById(updated._id);
      if (populate) query = query.populate(populate);
      res.json(await query);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          message: `Duplicate value for ${Object.keys(err.keyPattern || {}).join(', ') || 'unique field'}`,
        });
      }
      res.status(500).json({ message: err.message || 'Failed to update record' });
    }
  });

  router.delete('/:id', protect, async (req, res) => {
    try {
      const deleted = await Model.findOneAndDelete({ _id: req.params.id, ...tenantFilter(req) });
      if (!deleted) return res.status(404).json({ message: 'Record not found' });
      res.json({ message: 'Deleted successfully' });
    } catch (err) {
      res.status(500).json({ message: err.message || 'Failed to delete record' });
    }
  });

  return router;
};
