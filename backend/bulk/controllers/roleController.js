const Role = require('../models/Role');

const getRoles = async (req, res) => {
  try {
    // Global roles (tenantId: null) plus the caller's own tenant's roles.
    const roles = await Role.find({
      $or: [{ tenantId: null }, ...(req.tenantId ? [{ tenantId: req.tenantId }] : [])],
    }).sort({ createdAt: 1 });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createRole = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (req.tenantId) payload.tenantId = req.tenantId;
    const role = await Role.create(payload);
    res.status(201).json(role);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { getRoles, createRole };
