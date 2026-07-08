const AutoReply = require('../src/repositories/AutoReply');
const aiChatbotService = require('../src/services/aiChatbotService');
const { resolveAutoReplyAction } = require('../src/middleware/autoReply');

jest.mock('../src/repositories/AutoReply', () => ({ find: jest.fn() }));
jest.mock('../src/services/aiChatbotService', () => ({ generateReply: jest.fn() }));

const mockFind = (rules) => {
  AutoReply.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(rules) });
};

describe('resolveAutoReplyAction — ai_assistant fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to an active ai_assistant rule when no keyword matches', async () => {
    const aiRule = {
      _id: 'rule-1',
      isActive: true,
      ruleType: 'ai_assistant',
      aiSystemPrompt: 'Be helpful.',
      aiModel: '',
      delaySeconds: 3,
    };
    mockFind([aiRule]);
    aiChatbotService.generateReply.mockResolvedValue('Thanks for reaching out!');

    const result = await resolveAutoReplyAction({ incomingText: 'anything not a keyword', filters: { userId: 'u1' } });

    expect(aiChatbotService.generateReply).toHaveBeenCalledWith({
      systemPrompt: 'Be helpful.',
      incomingText: 'anything not a keyword',
      model: '',
    });
    expect(result).toEqual({
      _id: 'rule-1',
      ruleType: 'ai_assistant',
      replyType: 'text',
      reply: 'Thanks for reaching out!',
      delaySeconds: 3,
    });
  });

  it('prefers a matching keyword rule over the ai_assistant fallback', async () => {
    const keywordRule = { _id: 'rule-2', isActive: true, ruleType: 'keyword', keyword: 'price', matchType: 'contains', reply: 'Our price list...' };
    const aiRule = { _id: 'rule-1', isActive: true, ruleType: 'ai_assistant' };
    mockFind([keywordRule, aiRule]);

    const result = await resolveAutoReplyAction({ incomingText: 'what is the price?', filters: {} });

    expect(result).toBe(keywordRule);
    expect(aiChatbotService.generateReply).not.toHaveBeenCalled();
  });

  it('returns null when the AI call fails, without throwing', async () => {
    const aiRule = { _id: 'rule-1', isActive: true, ruleType: 'ai_assistant' };
    mockFind([aiRule]);
    aiChatbotService.generateReply.mockRejectedValue(new Error('upstream error'));

    const result = await resolveAutoReplyAction({ incomingText: 'hello', filters: {} });

    expect(result).toBeNull();
  });

  it('returns null when there is no matching rule and no ai_assistant rule', async () => {
    mockFind([]);

    const result = await resolveAutoReplyAction({ incomingText: 'hello', filters: {} });

    expect(result).toBeNull();
  });
});
