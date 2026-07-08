const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

const { generateReply, DEFAULT_MODEL } = require('../src/services/aiChatbotService');

describe('aiChatbotService.generateReply', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterAll(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('returns null without calling the API when no key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const reply = await generateReply({ incomingText: 'hi' });

    expect(reply).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns null for empty incoming text', async () => {
    const reply = await generateReply({ incomingText: '   ' });

    expect(reply).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('defaults to claude-opus-4-8 and returns the text block', async () => {
    mockCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '  Sure, here is your order status.  ' }],
    });

    const reply = await generateReply({ incomingText: 'Where is my order?' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: DEFAULT_MODEL, max_tokens: 300 })
    );
    expect(reply).toBe('Sure, here is your order status.');
  });

  it('honors a per-rule model override and system prompt', async () => {
    mockCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Hello!' }],
    });

    await generateReply({ incomingText: 'hi', model: 'claude-haiku-4-5', systemPrompt: 'Be terse.' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5', system: 'Be terse.' })
    );
  });

  it('returns null when the model refuses to respond', async () => {
    mockCreate.mockResolvedValue({ stop_reason: 'refusal', content: [] });

    const reply = await generateReply({ incomingText: 'hi' });

    expect(reply).toBeNull();
  });
});
