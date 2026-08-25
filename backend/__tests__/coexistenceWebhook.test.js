const {
  COEXISTENCE_FIELDS,
  extractCoexistenceEvents,
  createCoexistenceProcessor,
} = require('../src/services/coexistenceService');

// Mongoose models and the account lookup are the only things the processor
// touches that need a database, so they're stubbed. The parsing half
// (extractCoexistenceEvents) is pure and tested directly.
jest.mock('../src/repositories/whatsappAccount', () => ({ updateOne: jest.fn().mockResolvedValue({}) }));
jest.mock('../src/repositories/contact', () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({}),
  updateOne: jest.fn().mockResolvedValue({}),
}));
jest.mock('../src/services/whatsappAccountService', () => ({
  loadWhatsAppAccountFromWebhookIdentifiers: jest.fn(),
}));

const WhatsAppAccount = require('../src/repositories/whatsappAccount');
const Contact = require('../src/repositories/contact');
const { loadWhatsAppAccountFromWebhookIdentifiers } = require('../src/services/whatsappAccountService');

const ACCOUNT = { _id: 'acct-1', userId: 'user-1' };

const metadata = {
  display_phone_number: '15550001111',
  phone_number_id: '1234567890',
};

const echoPayload = (message) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '999888777',
      changes: [
        {
          field: 'smb_message_echoes',
          value: { messaging_product: 'whatsapp', metadata, message_echoes: [message] },
        },
      ],
    },
  ],
});

describe('extractCoexistenceEvents', () => {
  it('extracts smb_message_echoes with the change metadata attached', () => {
    const { echoes, historyChunks, stateSyncs } = extractCoexistenceEvents(
      echoPayload({ from: '15550001111', to: '919999999999', id: 'wamid.echo1', timestamp: '1700000000', type: 'text', text: { body: 'On my way' } }).entry
    );

    expect(historyChunks).toHaveLength(0);
    expect(stateSyncs).toHaveLength(0);
    expect(echoes).toHaveLength(1);
    expect(echoes[0]).toMatchObject({
      phoneNumberId: '1234567890',
      displayPhoneNumber: '15550001111',
      wabaId: '999888777',
    });
    expect(echoes[0].message.id).toBe('wamid.echo1');
  });

  it('extracts history chunks with their progress metadata and threads', () => {
    const { historyChunks } = extractCoexistenceEvents([
      {
        id: '999888777',
        changes: [
          {
            field: 'history',
            value: {
              messaging_product: 'whatsapp',
              metadata,
              history: [
                {
                  metadata: { phase: '0', chunk_order: 1, progress: 40 },
                  threads: [{ id: '919999999999', messages: [{ id: 'wamid.h1', from: '919999999999', type: 'text', text: { body: 'hi' } }] }],
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(historyChunks).toHaveLength(1);
    expect(historyChunks[0].metadata).toEqual({ phase: '0', chunk_order: 1, progress: 40 });
    expect(historyChunks[0].threads[0].messages[0].id).toBe('wamid.h1');
  });

  it('extracts smb_app_state_sync contact items', () => {
    const { stateSyncs } = extractCoexistenceEvents([
      {
        id: '999888777',
        changes: [
          {
            field: 'smb_app_state_sync',
            value: {
              messaging_product: 'whatsapp',
              metadata,
              state_sync: [{ type: 'contact', action: 'add', contact: { full_name: 'Asha R', phone_number: '+91 99999 99999' } }],
            },
          },
        ],
      },
    ]);

    expect(stateSyncs).toHaveLength(1);
    expect(stateSyncs[0].item.contact.full_name).toBe('Asha R');
  });

  it('ignores ordinary messages/statuses changes and malformed payloads', () => {
    const messagesOnly = extractCoexistenceEvents([
      { id: '1', changes: [{ field: 'messages', value: { metadata, messages: [{ id: 'wamid.x' }] } }] },
    ]);
    expect(messagesOnly).toEqual({ echoes: [], historyChunks: [], stateSyncs: [] });

    // Anything unexpected must degrade to "no events", never throw — this runs
    // inside the webhook handler.
    expect(extractCoexistenceEvents(undefined)).toEqual({ echoes: [], historyChunks: [], stateSyncs: [] });
    expect(extractCoexistenceEvents([{ changes: 'nope' }])).toEqual({ echoes: [], historyChunks: [], stateSyncs: [] });
    expect(
      extractCoexistenceEvents([{ id: '1', changes: [{ field: 'smb_message_echoes', value: {} }] }])
    ).toEqual({ echoes: [], historyChunks: [], stateSyncs: [] });
  });

  it('declares exactly the three coexistence webhook fields', () => {
    expect(COEXISTENCE_FIELDS.sort()).toEqual(['history', 'smb_app_state_sync', 'smb_message_echoes']);
  });
});

describe('coexistence processor', () => {
  const parseIncoming = (msg) => {
    if (msg?.type !== 'text') return null;
    return { type: 'text', message: msg.text?.body || '', mediaId: '' };
  };

  let saveAndEmitMessage;
  let forwardToWebhookDestinations;
  let processor;

  beforeEach(() => {
    jest.clearAllMocks();
    loadWhatsAppAccountFromWebhookIdentifiers.mockResolvedValue({ account: ACCOUNT });
    saveAndEmitMessage = jest.fn().mockResolvedValue({ message: { _id: 'm1' }, isDuplicate: false });
    forwardToWebhookDestinations = jest.fn().mockResolvedValue(undefined);
    processor = createCoexistenceProcessor({ parseIncoming, saveAndEmitMessage, forwardToWebhookDestinations });
  });

  it('stores an echo as an outgoing message owned by the matched account', async () => {
    const { echoes } = extractCoexistenceEvents(
      echoPayload({ from: '15550001111', to: '919999999999', id: 'wamid.echo1', timestamp: '1700000000', type: 'text', text: { body: 'On my way' } }).entry
    );

    await processor.processEchoes(echoes);

    expect(saveAndEmitMessage).toHaveBeenCalledTimes(1);
    expect(saveAndEmitMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        whatsappAccountId: 'acct-1',
        direction: 'outgoing',
        fromMe: true,
        status: 'sent',
        from: '15550001111',
        to: '919999999999',
        message: 'On my way',
        messageId: 'wamid.echo1',
        source: 'coexistence_app',
        isHistorical: false,
      })
    );
    expect(saveAndEmitMessage.mock.calls[0][0].timestamp).toEqual(new Date(1700000000 * 1000));
  });

  it('does not reopen the 24-hour window on an echo (business-initiated)', async () => {
    const { echoes } = extractCoexistenceEvents(
      echoPayload({ from: '15550001111', to: '919999999999', id: 'wamid.echo2', timestamp: '1700000000', type: 'text', text: { body: 'hello' } }).entry
    );

    await processor.processEchoes(echoes);

    const contactUpdate = Contact.findOneAndUpdate.mock.calls[0][1];
    expect(JSON.stringify(contactUpdate)).not.toContain('windowOpen');
    expect(contactUpdate.$set).toMatchObject({ lastMessage: 'hello' });
  });

  it('forwards echoes to webhook destinations so sibling bots can stand down', async () => {
    const { echoes } = extractCoexistenceEvents(
      echoPayload({ from: '15550001111', to: '919999999999', id: 'wamid.echo3', timestamp: '1700000000', type: 'text', text: { body: 'handled' } }).entry
    );

    await processor.processEchoes(echoes);

    expect(forwardToWebhookDestinations).toHaveBeenCalledWith(
      'acct-1',
      expect.objectContaining({ event: 'message.echo', source: 'coexistence_app', messageId: 'wamid.echo3' })
    );
  });

  it('skips a duplicate echo of a message this platform already sent', async () => {
    saveAndEmitMessage.mockResolvedValue({ message: { _id: 'm1' }, isDuplicate: true });
    const { echoes } = extractCoexistenceEvents(
      echoPayload({ from: '15550001111', to: '919999999999', id: 'wamid.dup', timestamp: '1700000000', type: 'text', text: { body: 'sent via API' } }).entry
    );

    await processor.processEchoes(echoes);

    expect(Contact.findOneAndUpdate).not.toHaveBeenCalled();
    expect(forwardToWebhookDestinations).not.toHaveBeenCalled();
  });

  it('imports history, deriving direction from the business number', async () => {
    const { historyChunks } = extractCoexistenceEvents([
      {
        id: '999888777',
        changes: [
          {
            field: 'history',
            value: {
              messaging_product: 'whatsapp',
              metadata,
              history: [
                {
                  metadata: { phase: '0', chunk_order: 1, progress: 100 },
                  threads: [
                    {
                      id: '919999999999',
                      messages: [
                        { id: 'wamid.in', from: '919999999999', to: '15550001111', timestamp: '1700000000', type: 'text', text: { body: 'customer said' } },
                        { id: 'wamid.out', from: '15550001111', to: '919999999999', timestamp: '1700000060', type: 'text', text: { body: 'business said' } },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    ]);

    await processor.processHistoryChunks(historyChunks);

    expect(saveAndEmitMessage).toHaveBeenCalledTimes(2);
    expect(saveAndEmitMessage.mock.calls[0][0]).toMatchObject({
      direction: 'incoming',
      status: 'received',
      isHistorical: true,
      source: 'coexistence_history',
    });
    expect(saveAndEmitMessage.mock.calls[1][0]).toMatchObject({
      direction: 'outgoing',
      status: 'sent',
      isHistorical: true,
    });

    const accountUpdate = WhatsAppAccount.updateOne.mock.calls.at(-1)[1];
    expect(accountUpdate.$set['coexistence.historySyncStatus']).toBe('completed');
    expect(accountUpdate.$set['coexistence.historySyncProgress']).toBe(100);
    expect(accountUpdate.$inc).toEqual({
      'coexistence.historyChunksReceived': 1,
      'coexistence.historyMessagesImported': 2,
    });
  });

  it('never issues an empty $set when a history thread only implies a contact', async () => {
    const { historyChunks } = extractCoexistenceEvents([
      {
        id: '999888777',
        changes: [
          {
            field: 'history',
            value: {
              messaging_product: 'whatsapp',
              metadata,
              history: [{ metadata: { progress: 10 }, threads: [{ id: '919999999999', messages: [] }] }],
            },
          },
        ],
      },
    ]);

    await processor.processHistoryChunks(historyChunks);

    // Mongo rejects `{$set: {}}` outright, so the key must be absent entirely.
    const update = Contact.findOneAndUpdate.mock.calls[0][1];
    expect(update).not.toHaveProperty('$set');
    expect(update.$setOnInsert).toMatchObject({ phone: '919999999999', userId: 'user-1' });
  });

  it('marks history in_progress while progress is below 100', async () => {
    const { historyChunks } = extractCoexistenceEvents([
      {
        id: '999888777',
        changes: [
          {
            field: 'history',
            value: { messaging_product: 'whatsapp', metadata, history: [{ metadata: { progress: 25 }, threads: [] }] },
          },
        ],
      },
    ]);

    await processor.processHistoryChunks(historyChunks);

    expect(WhatsAppAccount.updateOne.mock.calls.at(-1)[1].$set['coexistence.historySyncStatus']).toBe('in_progress');
  });

  it('upserts a contact from smb_app_state_sync and never deletes on removal', async () => {
    const { stateSyncs } = extractCoexistenceEvents([
      {
        id: '999888777',
        changes: [
          {
            field: 'smb_app_state_sync',
            value: {
              messaging_product: 'whatsapp',
              metadata,
              state_sync: [
                { type: 'contact', action: 'add', contact: { full_name: 'Asha R', phone_number: '+91 99999 99999' } },
                { type: 'contact', action: 'remove', contact: { full_name: 'Old Lead', phone_number: '918888888888' } },
              ],
            },
          },
        ],
      },
    ]);

    await processor.processStateSyncs(stateSyncs);

    expect(Contact.findOneAndUpdate).toHaveBeenCalledWith(
      { phone: '919999999999', userId: 'user-1' },
      expect.objectContaining({ $set: expect.objectContaining({ name: 'Asha R' }) }),
      { upsert: true }
    );
    // Removal is recorded, not destructive.
    expect(Contact.updateOne).toHaveBeenCalledWith(
      { phone: '918888888888', userId: 'user-1' },
      { $set: { 'customFields.coexistenceRemovedAt': expect.any(Date) } }
    );
  });

  it('still stores events for an unmatched account without throwing', async () => {
    loadWhatsAppAccountFromWebhookIdentifiers.mockResolvedValue({ account: null });
    const { echoes } = extractCoexistenceEvents(
      echoPayload({ from: '15550001111', to: '919999999999', id: 'wamid.orphan', timestamp: '1700000000', type: 'text', text: { body: 'orphan' } }).entry
    );

    await expect(processor.processEchoes(echoes)).resolves.toBeUndefined();
    expect(saveAndEmitMessage).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined, messageId: 'wamid.orphan' }));
    expect(WhatsAppAccount.updateOne).not.toHaveBeenCalled();
  });

  it('does not abort the batch when one event fails', async () => {
    saveAndEmitMessage
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValue({ message: { _id: 'm2' }, isDuplicate: false });

    const { echoes } = extractCoexistenceEvents([
      {
        id: '999888777',
        changes: [
          {
            field: 'smb_message_echoes',
            value: {
              messaging_product: 'whatsapp',
              metadata,
              message_echoes: [
                { from: '15550001111', to: '911', id: 'wamid.bad', timestamp: '1700000000', type: 'text', text: { body: 'a' } },
                { from: '15550001111', to: '912', id: 'wamid.good', timestamp: '1700000000', type: 'text', text: { body: 'b' } },
              ],
            },
          },
        ],
      },
    ]);

    await processor.processEchoes(echoes);

    expect(saveAndEmitMessage).toHaveBeenCalledTimes(2);
    expect(saveAndEmitMessage.mock.calls[1][0].messageId).toBe('wamid.good');
  });
});
