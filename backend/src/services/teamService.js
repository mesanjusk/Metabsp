const WhatsAppAccount = require('../repositories/whatsappAccount');
const User = require('../../bulk/models/User');
const AppError = require('../utils/AppError');

const normalizeMobile = (value) => String(value || '').replace(/\D/g, '');

const findAccountOwnedByUser = async (accountId, ownerUserId) => {
  const account = await WhatsAppAccount.findOne({ _id: accountId, userId: ownerUserId });
  if (!account) throw new AppError('Account not found', 404);
  return account;
};

const listTeamMembers = async (account) => {
  const populated = await account.populate('teamMemberIds', 'name mobile email');
  return populated.teamMemberIds || [];
};

const addTeamMember = async ({ accountId, ownerUserId, mobile }) => {
  const account = await findAccountOwnedByUser(accountId, ownerUserId);
  const normalizedMobile = normalizeMobile(mobile);
  if (!normalizedMobile) throw new AppError('mobile is required', 400);

  const member = await User.findOne({ mobile: normalizedMobile });
  if (!member) throw new AppError('No platform user found with that mobile number', 404);
  if (String(member._id) === String(ownerUserId)) throw new AppError('You already own this account', 400);

  const alreadyMember = account.teamMemberIds.some((id) => String(id) === String(member._id));
  if (!alreadyMember) {
    account.teamMemberIds.push(member._id);
    await account.save();
  }

  return member;
};

const removeTeamMember = async ({ accountId, ownerUserId, memberUserId }) => {
  const account = await findAccountOwnedByUser(accountId, ownerUserId);
  account.teamMemberIds = account.teamMemberIds.filter((id) => String(id) !== String(memberUserId));
  await account.save();
  return account;
};

module.exports = {
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
};
