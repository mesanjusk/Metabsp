const WhatsAppAccount = require('../src/repositories/whatsappAccount');
const User = require('../bulk/models/User');
const { listTeamMembers, addTeamMember, removeTeamMember } = require('../src/services/teamService');

jest.mock('../src/repositories/whatsappAccount', () => ({ findOne: jest.fn() }));
jest.mock('../bulk/models/User', () => ({ findOne: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('teamService.addTeamMember', () => {
  it('adds a platform user found by mobile as a team member', async () => {
    const account = { _id: 'acc-1', userId: 'owner-1', teamMemberIds: [], save: jest.fn().mockResolvedValue() };
    WhatsAppAccount.findOne.mockResolvedValue(account);
    User.findOne.mockResolvedValue({ _id: 'user-2', name: 'Agent Two', mobile: '9000000002' });

    const member = await addTeamMember({ accountId: 'acc-1', ownerUserId: 'owner-1', mobile: '9000000002' });

    expect(WhatsAppAccount.findOne).toHaveBeenCalledWith({ _id: 'acc-1', userId: 'owner-1' });
    expect(User.findOne).toHaveBeenCalledWith({ mobile: '9000000002' });
    expect(account.teamMemberIds).toEqual(['user-2']);
    expect(account.save).toHaveBeenCalled();
    expect(member.mobile).toBe('9000000002');
  });

  it('is idempotent when the member is already on the account', async () => {
    const account = { _id: 'acc-1', userId: 'owner-1', teamMemberIds: ['user-2'], save: jest.fn().mockResolvedValue() };
    WhatsAppAccount.findOne.mockResolvedValue(account);
    User.findOne.mockResolvedValue({ _id: 'user-2', mobile: '9000000002' });

    await addTeamMember({ accountId: 'acc-1', ownerUserId: 'owner-1', mobile: '9000000002' });

    expect(account.teamMemberIds).toEqual(['user-2']);
    expect(account.save).not.toHaveBeenCalled();
  });

  it('rejects when the account is not owned by the requesting user', async () => {
    WhatsAppAccount.findOne.mockResolvedValue(null);

    await expect(addTeamMember({ accountId: 'acc-1', ownerUserId: 'not-owner', mobile: '9000000002' })).rejects.toThrow('Account not found');
  });

  it('rejects when no platform user matches the mobile number', async () => {
    WhatsAppAccount.findOne.mockResolvedValue({ _id: 'acc-1', userId: 'owner-1', teamMemberIds: [] });
    User.findOne.mockResolvedValue(null);

    await expect(addTeamMember({ accountId: 'acc-1', ownerUserId: 'owner-1', mobile: '9000000099' })).rejects.toThrow('No platform user found');
  });

  it('rejects adding the owner as their own team member', async () => {
    WhatsAppAccount.findOne.mockResolvedValue({ _id: 'acc-1', userId: 'owner-1', teamMemberIds: [] });
    User.findOne.mockResolvedValue({ _id: 'owner-1', mobile: '9000000001' });

    await expect(addTeamMember({ accountId: 'acc-1', ownerUserId: 'owner-1', mobile: '9000000001' })).rejects.toThrow('already own this account');
  });
});

describe('teamService.removeTeamMember', () => {
  it('removes a member by userId', async () => {
    const account = { _id: 'acc-1', userId: 'owner-1', teamMemberIds: ['user-2', 'user-3'], save: jest.fn().mockResolvedValue() };
    WhatsAppAccount.findOne.mockResolvedValue(account);

    await removeTeamMember({ accountId: 'acc-1', ownerUserId: 'owner-1', memberUserId: 'user-2' });

    expect(account.teamMemberIds).toEqual(['user-3']);
    expect(account.save).toHaveBeenCalled();
  });
});

describe('teamService.listTeamMembers', () => {
  it('populates and returns the team members', async () => {
    const populated = { teamMemberIds: [{ _id: 'user-2', name: 'Agent Two', mobile: '9000000002' }] };
    const account = { populate: jest.fn().mockResolvedValue(populated) };

    const members = await listTeamMembers(account);

    expect(account.populate).toHaveBeenCalledWith('teamMemberIds', 'name mobile email');
    expect(members).toEqual(populated.teamMemberIds);
  });
});
