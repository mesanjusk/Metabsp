import { describe, expect, it, vi, beforeEach } from 'vitest';

const findOne = vi.fn();
vi.mock('@/lib/models/Message', () => ({
  default: { findOne: (...args: any[]) => findOne(...args) },
}));

const { checkWhatsApp24hWindow } = await import('@/lib/whatsapp/twentyFourHourGuard');

const lastIncoming = (at: Date) => ({ sort: () => ({ lean: async () => ({ timestamp: at }) }) });
const noIncoming = () => ({ sort: () => ({ lean: async () => null }) });

const HOUR = 60 * 60 * 1000;

/**
 * Meta's 24-hour customer service window. Getting this wrong in one direction
 * blocks legitimate replies; in the other it produces sends the Cloud API
 * rejects and that count against the number's quality rating.
 */
describe('24-hour customer service window', () => {
  beforeEach(() => findOne.mockReset());

  it('allows free-form text while the customer messaged within the last 24 hours', async () => {
    findOne.mockReturnValue(lastIncoming(new Date(Date.now() - 2 * HOUR)));

    const result = await checkWhatsApp24hWindow({ messageType: 'text', to: '919876543210', userId: 'u1' });
    expect(result.allowed).toBe(true);
    expect(result.isInsideWindow).toBe(true);
  });

  it('blocks free-form text once the window has closed', async () => {
    findOne.mockReturnValue(lastIncoming(new Date(Date.now() - 25 * HOUR)));

    const result = await checkWhatsApp24hWindow({ messageType: 'text', to: '919876543210', userId: 'u1' });
    expect(result.allowed).toBe(false);
    expect(result.isInsideWindow).toBe(false);
  });

  it('still allows a TEMPLATE outside the window — that is the whole point of templates', async () => {
    findOne.mockReturnValue(lastIncoming(new Date(Date.now() - 25 * HOUR)));

    const result = await checkWhatsApp24hWindow({ messageType: 'template', to: '919876543210', userId: 'u1' });
    expect(result.allowed).toBe(true);
    expect(result.isInsideWindow).toBe(false);
  });

  it('blocks free-form text to someone who has never messaged the business', async () => {
    findOne.mockReturnValue(noIncoming());

    const result = await checkWhatsApp24hWindow({ messageType: 'text', to: '919876543210', userId: 'u1' });
    expect(result.allowed).toBe(false);
    expect(result.lastUserMessageAt).toBeNull();
  });

  it('scopes the lookup to the sending account, so one tenant cannot open another tenant\'s window', async () => {
    findOne.mockReturnValue(lastIncoming(new Date()));

    await checkWhatsApp24hWindow({
      messageType: 'text',
      to: '919876543210',
      userId: 'u1',
      whatsappAccountId: 'acct-1',
    });

    const filter = findOne.mock.calls.at(-1)?.[0] as any;
    expect(filter.whatsappAccountId).toBe('acct-1');
    expect(filter.userId).toBe('u1');
  });

  it('does not block when the conversation cannot be identified at all', async () => {
    // No phone, no contact, no conversation id: there is nothing to look up,
    // and refusing every such send would break callers that pass an id shape
    // this guard does not recognise. It logs and defers instead.
    const result = await checkWhatsApp24hWindow({ messageType: 'text', userId: 'u1' });
    expect(result.allowed).toBe(true);
    expect(findOne).not.toHaveBeenCalled();
  });
});
