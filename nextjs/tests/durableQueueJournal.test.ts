import { describe, expect, it } from 'vitest';
import {
  durableWebhookId,
  stableDurableSendId,
} from '@/lib/services/durableQueueJournal';

describe('durable queue identifiers', () => {
  it('gives the same signed webhook body the same recovery id', () => {
    const raw = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ id: 'waba-1', changes: [{ field: 'messages', value: { messages: [{ id: 'wamid.1' }] } }] }],
    });

    expect(durableWebhookId(raw)).toBe(durableWebhookId(raw));
    expect(durableWebhookId(raw)).toMatch(/^webhook-[a-f0-9]{64}$/);
  });

  it('changes the webhook id when the payload changes', () => {
    expect(durableWebhookId('{"id":1}')).not.toBe(durableWebhookId('{"id":2}'));
  });

  it('creates deterministic outbound ids for campaign recipient retries', () => {
    const key = 'account|user|campaign|0|919876543210';
    expect(stableDurableSendId(key)).toBe(stableDurableSendId(key));
    expect(stableDurableSendId(key)).toMatch(/^send-[a-f0-9]{64}$/);
    expect(stableDurableSendId(key)).not.toBe(stableDurableSendId(key + '|different'));
  });
});
