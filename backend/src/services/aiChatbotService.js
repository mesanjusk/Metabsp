const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

const DEFAULT_MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 300;
const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful WhatsApp customer support assistant for a small business. ' +
  'Reply concisely (a few sentences at most) and stay on topic.';

let cachedClient = null;
const getClient = () => {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
};

// Single Q&A-style completion for an inbound WhatsApp message — not an agent,
// so a plain messages.create() call is used (no tool use, no thinking: a short
// customer reply doesn't need it, and omitting `thinking` keeps latency down).
const generateReply = async ({ systemPrompt, incomingText, model }) => {
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

  if (response.stop_reason === 'refusal') {
    logger.warn('AI auto-reply refused by model safety classifier');
    return null;
  }

  const textBlock = (response.content || []).find((block) => block.type === 'text');
  const reply = textBlock?.text?.trim();
  return reply || null;
};

module.exports = { generateReply, DEFAULT_MODEL };
