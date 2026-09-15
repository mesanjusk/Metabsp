import Anthropic from '@anthropic-ai/sdk';
import AppError from '@/lib/utils/AppError';
import logger from '@/lib/utils/logger';
import type { NormalizedReview } from './profile';

/**
 * The drafting layer — the part every "AI local marketing" product is actually
 * selling. Nothing here publishes: a draft comes back to the owner, who edits
 * and presses the button. A profile reply is public and permanent under the
 * business's own name, which is exactly the wrong place for an unattended
 * model, and an owner who has to approve one line still saves the twenty
 * minutes of staring at a blank box that stops most replies being written.
 */
const DEFAULT_MODEL = 'claude-opus-5';
const MAX_TOKENS = 2000;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AppError('AI drafting is not configured on this server', 503);
  }
  if (!cachedClient) cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return cachedClient;
}

export function isAiDraftingConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type BusinessContext = {
  businessName: string;
  category?: string;
  address?: string;
  website?: string;
  description?: string;
};

function businessBlock(business: BusinessContext): string {
  return [
    `Business name: ${business.businessName || 'this business'}`,
    business.category ? `Category: ${business.category}` : '',
    business.address ? `Location: ${business.address}` : '',
    business.website ? `Website: ${business.website}` : '',
    business.description ? `Owner's own description: ${business.description}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function draft(system: string, prompt: string, label: string): Promise<string> {
  const client = getClient();
  try {
    const response = await client.messages.create({
      model: String(process.env.GOOGLE_BUSINESS_AI_MODEL || DEFAULT_MODEL),
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: prompt }],
      // Short marketing copy does not need deep reasoning, and the effort knob
      // is what keeps a one-paragraph draft from costing like an essay. It is
      // cast because the pinned SDK (0.32.x) predates the field; the API reads
      // it regardless, and an older model simply ignores it.
      ...({ output_config: { effort: 'low' } } as any),
    } as any);

    if ((response as any).stop_reason === 'refusal') {
      throw new AppError('The assistant declined to draft this. Edit the request and try again.', 422);
    }

    const textBlock: any = (response.content || []).find((block: any) => block.type === 'text');
    const text = String(textBlock?.text || '').trim();
    if (!text) throw new AppError('The assistant returned an empty draft', 502);
    return text;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error(`[google-business] ${label} draft failed:`, error?.message || error);
    if (error?.status === 429) throw new AppError('AI drafting is rate limited right now. Try again shortly.', 429);
    throw new AppError('Could not generate the draft', 502);
  }
}

const REPLY_SYSTEM = [
  'You write public replies to Google reviews on behalf of a small business owner.',
  'Rules you never break:',
  '- Reply in 2-4 sentences, under 700 characters, in the same language as the review.',
  '- Warm and specific, never corporate. Use the business name at most once.',
  '- Only mention facts given to you. Never invent a discount, a refund, a policy, a staff name or a detail the review did not state.',
  '- For a complaint: acknowledge the specific problem, take responsibility without admitting legal liability, and invite the customer to contact the business directly. Never argue and never blame the customer.',
  '- Never ask the reviewer to change or delete their rating.',
  '- Output only the reply text. No greeting label, no quotes, no explanation, no placeholders in brackets.',
].join('\n');

export async function draftReviewReply(
  business: BusinessContext,
  review: Pick<NormalizedReview, 'rating' | 'comment' | 'reviewer'>,
  tone = 'warm and professional'
): Promise<string> {
  const comment = String(review.comment || '').trim();
  const prompt = [
    businessBlock(business),
    '',
    `Star rating: ${review.rating || 'unrated'} out of 5`,
    `Reviewer's first name (use only if it reads naturally): ${review.reviewer || 'unknown'}`,
    comment ? `Review text:\n"""\n${comment.slice(0, 4000)}\n"""` : 'The customer left a rating with no written review.',
    '',
    `Tone: ${tone}.`,
    'Write the reply.',
  ].join('\n');

  return draft(REPLY_SYSTEM, prompt, 'review reply');
}

const POST_SYSTEM = [
  "You write Google Business Profile posts for a small business owner's own profile.",
  'Rules you never break:',
  '- 40-90 words, plain sentences, no hashtags, no emoji walls (at most one emoji), no ALL CAPS.',
  '- Lead with what the customer gets, not with "We are excited to announce".',
  '- Only use facts given to you. Never invent prices, discounts, opening hours, awards or claims.',
  '- Do not include a URL or phone number in the text; the post carries its own button.',
  '- Output only the post text. No title, no quotes, no numbering, no explanation.',
].join('\n');

export async function draftLocalPost(
  business: BusinessContext,
  topic: string,
  tone = 'friendly and local'
): Promise<string> {
  const idea = String(topic || '').trim();
  if (!idea) throw new AppError('Describe what the post should be about', 400);

  const prompt = [
    businessBlock(business),
    '',
    `What the owner wants to post about:\n"""\n${idea.slice(0, 2000)}\n"""`,
    '',
    `Tone: ${tone}.`,
    'Write the post.',
  ].join('\n');

  const text = await draft(POST_SYSTEM, prompt, 'local post');
  // Google rejects a local post over 1500 characters outright, so a long draft
  // is trimmed here rather than failing at publish time.
  return text.length > 1500 ? `${text.slice(0, 1497).trimEnd()}...` : text;
}

const REVIEW_REQUEST_SYSTEM = [
  'You write a short WhatsApp message asking a customer who has already been served to leave a Google review.',
  'Rules you never break:',
  '- Under 50 words, one short paragraph, written as the owner, not as a marketing team.',
  '- Thank them for their visit or order, then ask for the review as a favour, not an obligation.',
  '- Never offer anything in exchange for a review, and never ask for a five-star or positive review specifically. Both violate Google policy.',
  '- End with exactly the placeholder {{link}} on its own where the review link goes. Do not write any other URL.',
  '- Output only the message text.',
].join('\n');

export async function draftReviewRequest(business: BusinessContext, customerName = ''): Promise<string> {
  const prompt = [
    businessBlock(business),
    '',
    customerName ? `Customer's name: ${customerName}` : 'The customer name is unknown; do not guess one.',
    '',
    'Write the message.',
  ].join('\n');

  return draft(REVIEW_REQUEST_SYSTEM, prompt, 'review request');
}
