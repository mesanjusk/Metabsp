import WhatsAppAccount from '../models/WhatsAppAccount';
import User from '../models/User';
import AppError from '../utils/AppError';

// Ported from backend/src/services/teamService.js.
// Shared-inbox membership: which platform users may work an account they do
// not own.

const normalizeMobile = (value: unknown) => String(value || '').replace(/\D/g, '');

// Ownership is re-checked on every operation rather than trusted from the
// route, so a member can never manage the roster of an account they merely
// belong to.
const findAccountOwnedByUser = async (accountId: string, ownerUserId: string) => {
  const account: any = await WhatsAppAccount.findOne({ _id: accountId, userId: ownerUserId });
  if (!account) throw new AppError('Account not found', 404);
  return account;
};

export const listTeamMembers = async (account: any) => {
  const populated = await account.populate('teamMemberIds', 'name mobile email');
  return populated.teamMemberIds || [];
};

export const getOwnedAccount = findAccountOwnedByUser;

export const addTeamMember = async ({
  accountId,
  ownerUserId,
  mobile,
}: {
  accountId: string;
  ownerUserId: string;
  mobile: unknown;
}) => {
  const account = await findAccountOwnedByUser(accountId, ownerUserId);
  const normalizedMobile = normalizeMobile(mobile);
  if (!normalizedMobile) throw new AppError('mobile is required', 400);

  const member: any = await User.findOne({ mobile: normalizedMobile });
  if (!member) throw new AppError('No platform user found with that mobile number', 404);
  if (String(member._id) === String(ownerUserId)) throw new AppError('You already own this account', 400);

  const alreadyMember = account.teamMemberIds.some((id: unknown) => String(id) === String(member._id));
  if (!alreadyMember) {
    account.teamMemberIds.push(member._id);
    await account.save();
  }

  return member;
};

export const removeTeamMember = async ({
  accountId,
  ownerUserId,
  memberUserId,
}: {
  accountId: string;
  ownerUserId: string;
  memberUserId: string;
}) => {
  const account = await findAccountOwnedByUser(accountId, ownerUserId);
  account.teamMemberIds = account.teamMemberIds.filter(
    (id: unknown) => String(id) !== String(memberUserId)
  );
  await account.save();
  return account;
};
