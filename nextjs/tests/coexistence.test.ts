import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Coexistence (WhatsApp Business app + Cloud API on one number) had tests on
 * the Express side — backup/__tests__/coexistenceWebhook.test.js — which went
 * away with that codebase during the consolidation. Nothing replaced them, so
 * the three webhook fields that make coexistence work were shipping untested
 * while the docs still claimed they were verified. These are that replacement.
 *
 * What matters here is not that events are "handled" but that each of the four
 * rules the product depends on survives a refactor:
 *
 *   1. History is imported WITHOUT emitting a live message event per message.
 *   2. An echo is stored as outgoing (the business said it, not the customer).
 *   3. A contact removed from the phone's address book is marked, never deleted.
 *   4. An unrecognised payload shape yields no events rather than throwing —
 *      this runs inside the webhook path, where a throw becomes a retry storm.
 */

const emitNewMessage = vi.fn();
const emitHistorySyncProgress = vi.fn();
const messageCreate = vi.fn(async (payload: any) => ({ ...payload, toObject: () => payload }));
const messageFindOne = vi.fn(() => ({ lean: async () => null }));
const contactFindOneAndUpdate = vi.fn(async () => ({}));
const contactUpdateOne = vi.fn(async () => ({}));
const accountUpdateOne = vi.fn(async () => ({}));

vi.mock('@/lib/socket/emitter', () => ({
  emitNewMessage,
  emitHistorySyncProgress,
  emitMessageStatus: vi.fn(),
}));

vi.mock('@/lib/models/Message', () => ({
  default: { create: messageCreate, findOne: messageFindOne },
}));

vi.mock('@/lib/models/Contact', () => ({
  default: { findOneAndUpdate: contactFindOneAndUpdate, updateOne: contactUpdateOne },
}));

vi.mock('@/lib/models/WhatsAppAccount', () => ({
  default: { updateOne: accountUpdateOne },
}));

vi.mock('@/lib/models/CampaignMessageStatus', () => ({ default: {} }));

// The account the webhook identifiers resolve to. Every coexistence handler
// goes through this one lookup.
vi.mock('@/lib/services/whatsappAccountService', () => ({
  loadWhatsAppAccountFromWebhookIdentifiers: vi.fn(async () => ({
    account: { _id: 'acct-1', userId: 'user-1' },
  })),
}));

vi.mock('@/lib/whatsapp/webhookProcessing', () => ({
  parseIncoming: (msg: any) => ({
    type: String(msg?.type || 'text'),
    message: String(msg?.text?.body || ''),
    mediaId: '',
    interactiveId: '',
  }),
  forwardToWebhookDestinations: vi.fn(async () => undefined),
}));

const {
  extractCoexistenceEvents,
  processHistoryChunks,
  processEchoes,
  processStateSyncs,
} = await import('@/lib/whatsapp/coexistence');

const BUSINESS_NUMBER = '919876500000';

const metadata = {
  display_phone_number: BUSINESS_NUMBER,
  phone_number_id: 'pn-1',
};

beforeEach(() => {
  emitNewMessage.mockClear();
  emitHistorySyncProgress.mockClear();
  messageCreate.mockClear();
  contactFindOneAndUpdate.mockClear();
  contactUpdateOne.mockClear();
  accountUpdateOne.mockClear();
});

describe('coexistence — event extraction', () => {
  it('separates the three fields and ignores ordinary message traffic', () => {
    const events = extractCoexistenceEvents([
      {
        id: 'waba-1',
        changes: [
          { field: 'messages', value: { metadata, messages: [{ id: 'wamid.live' }] } },
          { field: 'smb_message_echoes', value: { metadata, message_echoes: [{ id: 'wamid.echo' }] } },
          {
            field: 'history',
            value: { metadata, history: [{ metadata: { progress: 40 }, threads: [] }] },
          },
          {
            field: 'smb_app_state_sync',
            value: { metadata, state_sync: [{ type: 'contact', action: 'add' }] },
          },
        ],
      },
    ]);

    expect(events.echoes).toHaveLength(1);
    expect(events.historyChunks).toHaveLength(1);
    expect(events.stateSyncs).toHaveLength(1);
    // `messages` is the ordinary Cloud API path and must not be double-handled.
    expect(events.echoes[0].message.id).toBe('wamid.echo');
  });

  it('carries the business identifiers onto every extracted event', () => {
    const events = extractCoexistenceEvents([
      { id: 'waba-1', changes: [{ field: 'smb_message_echoes', value: { metadata, message_echoes: [{ id: 'x' }] } }] },
    ]);

    expect(events.echoes[0]).toMatchObject({
      phoneNumberId: 'pn-1',
      displayPhoneNumber: BUSINESS_NUMBER,
      wabaId: 'waba-1',
    });
  });

  it('yields nothing — rather than throwing — for malformed payloads', () => {
    // This runs inside the webhook request path. A throw here is a 5xx to
    // Meta, and a webhook that keeps 5xx-ing is a webhook Meta disables.
    for (const input of [null, undefined, {}, 'nonsense', [{ changes: 'not-an-array' }], [{}]]) {
      const events = extractCoexistenceEvents(input as any);
      expect(events).toEqual({ echoes: [], historyChunks: [], stateSyncs: [] });
    }
  });
});

describe('coexistence — history backfill', () => {
  const chunk = {
    phoneNumberId: 'pn-1',
    displayPhoneNumber: BUSINESS_NUMBER,
    wabaId: 'waba-1',
    businessAccountId: '',
    metadata: { progress: 40, phase: 'initial', chunk_order: 1 },
    threads: [
      {
        id: '919000011111',
        messages: [
          { id: 'wamid.h1', from: '919000011111', type: 'text', text: { body: 'from customer' }, timestamp: '1750000000' },
          { id: 'wamid.h2', from: BUSINESS_NUMBER, type: 'text', text: { body: 'from business' }, timestamp: '1750000100' },
        ],
      },
    ],
  };

  it('does NOT emit a live message event for imported history', async () => {
    // The bug this exists to prevent: a backfill of up to 180 days of chats
    // firing one `new_message` at every open browser per imported message —
    // the inbox thrashes and three-month-old messages announce themselves as
    // new. Progress is reported once per chunk instead.
    await processHistoryChunks([chunk] as any);

    expect(messageCreate).toHaveBeenCalledTimes(2);
    expect(emitNewMessage).not.toHaveBeenCalled();
    expect(emitHistorySyncProgress).toHaveBeenCalledTimes(1);
  });

  it('marks imported history as historical so it is never mistaken for live traffic', async () => {
    await processHistoryChunks([chunk] as any);

    for (const call of messageCreate.mock.calls) {
      expect(call[0]).toMatchObject({ isHistorical: true, source: 'coexistence_history' });
    }
  });

  it('derives direction by comparing each message against the business number', async () => {
    await processHistoryChunks([chunk] as any);

    const directions = messageCreate.mock.calls.map((call: any) => [call[0].messageId, call[0].direction]);
    expect(directions).toEqual([
      ['wamid.h1', 'incoming'],
      ['wamid.h2', 'outgoing'],
    ]);
  });

  it('reports progress and completion on the chunk, not per message', async () => {
    await processHistoryChunks([{ ...chunk, metadata: { progress: 100 } }] as any);

    expect(emitHistorySyncProgress).toHaveBeenCalledTimes(1);
    expect(emitHistorySyncProgress).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', status: 'completed', progress: 100, messagesImported: 2 })
    );
  });
});

describe('coexistence — message echoes', () => {
  const echo = {
    phoneNumberId: 'pn-1',
    displayPhoneNumber: BUSINESS_NUMBER,
    wabaId: 'waba-1',
    businessAccountId: '',
    message: {
      id: 'wamid.echo1',
      from: BUSINESS_NUMBER,
      to: '919000011111',
      type: 'text',
      text: { body: 'answered from my phone' },
      timestamp: '1750000200',
    },
  };

  it('stores what the business sent from its phone as an outgoing message', async () => {
    await processEchoes([echo] as any);

    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'outgoing', fromMe: true, source: 'coexistence_app' })
    );
  });

  it('emits it live — unlike history, an echo is something happening now', async () => {
    await processEchoes([echo] as any);
    expect(emitNewMessage).toHaveBeenCalledTimes(1);
  });

  it('is a no-op for a message this platform already sent through Cloud API', async () => {
    // Same wamid arriving back as an echo. Without de-duplication the shared
    // inbox shows every API-sent message twice.
    messageFindOne.mockReturnValueOnce({ lean: async () => ({ messageId: 'wamid.echo1' }) } as any);

    await processEchoes([echo] as any);

    expect(messageCreate).not.toHaveBeenCalled();
    expect(emitNewMessage).not.toHaveBeenCalled();
  });
});

describe('coexistence — contact state sync', () => {
  const sync = (item: any) => [
    {
      phoneNumberId: 'pn-1',
      displayPhoneNumber: BUSINESS_NUMBER,
      wabaId: 'waba-1',
      businessAccountId: '',
      item,
    },
  ];

  it('upserts a contact added on the phone', async () => {
    await processStateSyncs(sync({ type: 'contact', action: 'add', contact: { phone_number: '+91 90000-11111', full_name: 'Asha' } }) as any);

    expect(contactFindOneAndUpdate).toHaveBeenCalledTimes(1);
    const [query, update] = contactFindOneAndUpdate.mock.calls[0] as any;
    expect(query).toMatchObject({ phone: '919000011111', userId: 'user-1' });
    expect(update.$set).toMatchObject({ name: 'Asha' });
  });

  it('MARKS a removed contact rather than deleting it', async () => {
    // Dropping someone from a phone's address book must not destroy that
    // conversation's history or its billing and audit trail here.
    await processStateSyncs(sync({ type: 'contact', action: 'remove', contact: { phone_number: '919000011111' } }) as any);

    expect(contactUpdateOne).toHaveBeenCalledTimes(1);
    const [, update] = contactUpdateOne.mock.calls[0] as any;
    expect(update.$set['customFields.coexistenceRemovedAt']).toBeInstanceOf(Date);
  });

  it('ignores a sync item with no usable phone number', async () => {
    await processStateSyncs(sync({ type: 'contact', action: 'add', contact: {} }) as any);

    expect(contactFindOneAndUpdate).not.toHaveBeenCalled();
    expect(contactUpdateOne).not.toHaveBeenCalled();
  });
});
