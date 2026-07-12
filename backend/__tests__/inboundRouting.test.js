// Keyword routing for inbound messages on a shared WhatsApp number: each
// message goes only to the destination whose entry keyword starts it, or to
// the owner of the sender's active conversation — never blind fan-out to
// keyworded destinations.

jest.mock('../src/models/WebhookDestination', () => ({
  find: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({}),
  generateSecret: jest.fn(() => 'test-secret'),
}));

jest.mock('../src/models/ConversationOwner', () => ({
  TTL_MS: 30 * 60 * 1000,
  find: jest.fn(),
  findOne: jest.fn().mockResolvedValue(null),
  updateOne: jest.fn().mockResolvedValue({}),
  deleteOne: jest.fn().mockResolvedValue({}),
}));

const WebhookDestination = require('../src/models/WebhookDestination');
const ConversationOwner = require('../src/models/ConversationOwner');
const { resolveInboundRouting } = require('../src/controllers/whatsappController');

const ACCOUNT_ID = 'account-1';

const printDest = { _id: 'dest-print', label: 'Print-Mart', entryKeyword: 'PRINT', aliases: ['PRINTMART'], fanoutFallback: false };
const hostelDest = { _id: 'dest-hostel', label: 'Hostel', entryKeyword: 'HOSTEL', aliases: [], fanoutFallback: false };
const legacyDest = { _id: 'dest-legacy', label: 'Legacy', entryKeyword: '', aliases: [], fanoutFallback: false };

const mockDestinations = (list) => {
  WebhookDestination.find.mockReturnValue({ lean: () => Promise.resolve(list) });
};

const mockOwner = (owner) => {
  ConversationOwner.findOne.mockReturnValue({ lean: () => Promise.resolve(owner) });
};

const textPayload = (message, from = '919999999999') => ({ from, type: 'text', message });

beforeEach(() => {
  jest.clearAllMocks();
  mockOwner(null);
});

describe('resolveInboundRouting', () => {
  it('routes a keyword-prefixed message only to the destination owning that keyword', async () => {
    mockDestinations([printDest, hostelDest, legacyDest]);

    const routing = await resolveInboundRouting(ACCOUNT_ID, textPayload('PRINT need 500 flyers'));

    expect(routing.selfOwned).toBe(false);
    expect(routing.targets).toEqual([printDest]);
    expect(ConversationOwner.updateOne).toHaveBeenCalledWith(
      { whatsappAccountId: ACCOUNT_ID, phone: '919999999999' },
      { $set: expect.objectContaining({ ownerType: 'destination', destinationId: 'dest-print' }) },
      { upsert: true }
    );
  });

  it('matches aliases case-insensitively', async () => {
    mockDestinations([printDest, hostelDest]);

    const routing = await resolveInboundRouting(ACCOUNT_ID, textPayload('printmart'));

    expect(routing.targets).toEqual([printDest]);
  });

  it('does not treat a keyword mid-message or as a prefix of a longer word as a match', async () => {
    mockDestinations([printDest, hostelDest]);

    const routing = await resolveInboundRouting(ACCOUNT_ID, textPayload('PRINTING please'));

    expect(routing.targets).toEqual([]);
  });

  it('claims the conversation for Metabsp itself on SETUP and forwards to nobody', async () => {
    mockDestinations([printDest, hostelDest]);

    const routing = await resolveInboundRouting(ACCOUNT_ID, textPayload('SETUP'));

    expect(routing.selfOwned).toBe(true);
    expect(routing.targets).toEqual([]);
    expect(ConversationOwner.updateOne).toHaveBeenCalledWith(
      { whatsappAccountId: ACCOUNT_ID, phone: '919999999999' },
      { $set: expect.objectContaining({ ownerType: 'self', destinationId: null }) },
      { upsert: true }
    );
  });

  it('routes a generic message to the sender\'s active conversation owner and refreshes it', async () => {
    mockDestinations([printDest, hostelDest]);
    mockOwner({ _id: 'owner-1', ownerType: 'destination', destinationId: 'dest-hostel', lastActivityAt: new Date() });

    const routing = await resolveInboundRouting(ACCOUNT_ID, textPayload('hello'));

    expect(routing.targets).toEqual([hostelDest]);
    expect(ConversationOwner.updateOne).toHaveBeenCalledWith(
      { _id: 'owner-1' },
      { $set: { lastActivityAt: expect.any(Date) } }
    );
  });

  it('ignores an expired conversation owner (30-minute inactivity)', async () => {
    mockDestinations([printDest, hostelDest]);
    mockOwner({
      _id: 'owner-1',
      ownerType: 'destination',
      destinationId: 'dest-hostel',
      lastActivityAt: new Date(Date.now() - 31 * 60 * 1000),
    });

    const routing = await resolveInboundRouting(ACCOUNT_ID, textPayload('hello'));

    expect(routing.targets).toEqual([]);
  });

  it('still delivers EXIT to the active owner but releases the conversation', async () => {
    mockDestinations([printDest, hostelDest]);
    mockOwner({ _id: 'owner-1', ownerType: 'destination', destinationId: 'dest-hostel', lastActivityAt: new Date() });

    const routing = await resolveInboundRouting(ACCOUNT_ID, textPayload('EXIT'));

    expect(routing.targets).toEqual([hostelDest]);
    expect(ConversationOwner.deleteOne).toHaveBeenCalledWith({ _id: 'owner-1' });
  });

  it('keeps Metabsp\'s own bot in charge of an active self-owned conversation', async () => {
    mockDestinations([printDest]);
    mockOwner({ _id: 'owner-1', ownerType: 'self', destinationId: null, lastActivityAt: new Date() });

    const routing = await resolveInboundRouting(ACCOUNT_ID, textPayload('2'));

    expect(routing.selfOwned).toBe(true);
    expect(routing.targets).toEqual([]);
  });

  it('falls back to keyword-less (legacy) and fanoutFallback destinations for unmatched messages', async () => {
    const optedIn = { ...hostelDest, fanoutFallback: true };
    mockDestinations([printDest, optedIn, legacyDest]);

    const routing = await resolveInboundRouting(ACCOUNT_ID, textPayload('hi'));

    expect(routing.selfOwned).toBe(false);
    expect(routing.targets).toEqual([optedIn, legacyDest]);
  });

  it('forwards an unmatched message to nobody once every destination has a keyword and fallback is off', async () => {
    mockDestinations([printDest, hostelDest]);

    const routing = await resolveInboundRouting(ACCOUNT_ID, textPayload('HELLO'));

    expect(routing.targets).toEqual([]);
  });

  it('routes non-text messages (media/interactive) by conversation owner, never by keyword', async () => {
    mockDestinations([printDest, hostelDest]);
    mockOwner({ _id: 'owner-1', ownerType: 'destination', destinationId: 'dest-print', lastActivityAt: new Date() });

    const routing = await resolveInboundRouting(ACCOUNT_ID, {
      from: '919999999999',
      type: 'image',
      message: 'PRINT', // caption text must not count as a keyword
    });

    expect(routing.targets).toEqual([printDest]);
  });
});
