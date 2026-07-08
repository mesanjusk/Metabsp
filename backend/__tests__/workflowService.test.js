const Workflow = require('../src/repositories/Workflow');
const { resolveMatchingWorkflow } = require('../src/services/workflowService');

jest.mock('../src/repositories/Workflow', () => ({ find: jest.fn() }));

const mockFind = (workflows) => {
  Workflow.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(workflows) });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('workflowService.resolveMatchingWorkflow', () => {
  it('returns the workflow whose keyword matches the incoming text', async () => {
    const workflow = { _id: 'wf-1', isActive: true, keyword: 'onboard', matchType: 'contains', steps: [{ reply: 'Welcome!' }] };
    mockFind([workflow]);

    const result = await resolveMatchingWorkflow('please onboard me', { userId: 'u1' });

    expect(result).toBe(workflow);
  });

  it('returns null when no workflow matches', async () => {
    mockFind([{ _id: 'wf-1', isActive: true, keyword: 'onboard', matchType: 'exact', steps: [] }]);

    const result = await resolveMatchingWorkflow('hello there', { userId: 'u1' });

    expect(result).toBeNull();
  });

  it('falls back to the user-scoped list when the account-scoped list is empty', async () => {
    Workflow.find
      .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ sort: jest.fn().mockResolvedValue([{ _id: 'wf-2', isActive: true, keyword: 'hi', matchType: 'contains' }]) });

    const result = await resolveMatchingWorkflow('hi there', { userId: 'u1', whatsappAccountId: 'acc-1' });

    expect(result._id).toBe('wf-2');
    expect(Workflow.find).toHaveBeenNthCalledWith(2, { isActive: true, userId: 'u1' });
  });
});
