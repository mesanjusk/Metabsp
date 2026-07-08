const ConversationAssignment = require('../models/ConversationAssignment');

const getAssignmentsForAccount = async (whatsappAccountId) => {
  const rows = await ConversationAssignment.find({ whatsappAccountId }).lean();
  const byPhone = new Map();
  rows.forEach((row) => byPhone.set(row.contactPhone, row.assignedToUserId ? String(row.assignedToUserId) : null));
  return byPhone;
};

const setAssignment = async ({ whatsappAccountId, contactPhone, assignedToUserId }) =>
  ConversationAssignment.findOneAndUpdate(
    { whatsappAccountId, contactPhone },
    { $set: { assignedToUserId: assignedToUserId || null } },
    { upsert: true, new: true }
  );

module.exports = {
  getAssignmentsForAccount,
  setAssignment,
};
