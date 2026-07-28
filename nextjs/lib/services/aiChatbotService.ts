import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger';

// Ported from backend/src/services/aiChatbotService.js.
const DEFAULT_MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 300;
const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful WhatsApp customer support assistant for a small business. ' +
  'Reply concisely (a few sentences at most) and stay on topic.';

let cachedClient: Anthropic | null = null;
const getClient = (): Anthropic => {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
};

export const generateReply = async ({
  systemPrompt,
  incomingText,
  model,
}: {
  systemPrompt?: string;
  incomingText: string;
  model?: string;
}): Promise<string | null> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn('AI auto-reply skipped: ANTHROPIC_API_KEY is not configured');
    return null;
  }

  const text = String(incomingText || '').trim();
  if (!text) return null;

  const client = getClient();
  const response = await client.messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt || DEFAULT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: text }],
  });

  if ((response as any).stop_reason === 'refusal') {
    logger.warn('AI auto-reply refused by model safety classifier');
    return null;
  }

  const textBlock: any = (response.content || []).find((block: any) => block.type === 'text');
  const reply = textBlock?.text?.trim();
  return reply || null;
};

export const DEFAULT_MODEL_NAME = DEFAULT_MODEL;
