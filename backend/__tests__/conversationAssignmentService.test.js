const ConversationAssignment = require('../src/models/ConversationAssignment');
const { getAssignmentsForAccount, setAssignment } = require('../src/services/conversationAssignmentService');

jest.mock('../src/models/ConversationAssignment', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('conversationAssignmentService.getAssignmentsForAccount', () => {
  it('returns a phone -> assignedToUserId map', async () => {
    ConversationAssignment.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { contactPhone: '919000000001', assignedToUserId: 'user-1' },
        { contactPhone: '919000000002', assignedToUserId: null },
      ]),
    });

    const map = await getAssignmentsForAccount('acc-1');

    expect(ConversationAssignment.find).toHaveBeenCalledWith({ whatsappAccountId: 'acc-1' });
    expect(map.get('919000000001')).toBe('user-1');
    expect(map.get('919000000002')).toBeNull();
  });
});

describe('conversationAssignmentService.setAssignment', () => {
  it('upserts an assignment', async () => {
    ConversationAssignment.findOneAndUpdate.mockResolvedValue({ assignedToUserId: 'user-1' });

    const result = await setAssignment({ whatsappAccountId: 'acc-1', contactPhone: '919000000001', assignedToUserId: 'user-1' });

    expect(ConversationAssignment.findOneAndUpdate).toHaveBeenCalledWith(
      { whatsappAccountId: 'acc-1', contactPhone: '919000000001' },
      { $set: { assignedToUserId: 'user-1' } },
      { upsert: true, new: true }
    );
    expect(result.assignedToUserId).toBe('user-1');
  });

  it('unassigns when assignedToUserId is falsy', async () => {
    ConversationAssignment.findOneAndUpdate.mockResolvedValue({ assignedToUserId: null });

    await setAssignment({ whatsappAccountId: 'acc-1', contactPhone: '919000000001', assignedToUserId: '' });

    expect(ConversationAssignment.findOneAndUpdate).toHaveBeenCalledWith(
      { whatsappAccountId: 'acc-1', contactPhone: '919000000001' },
      { $set: { assignedToUserId: null } },
      { upsert: true, new: true }
    );
  });
});
