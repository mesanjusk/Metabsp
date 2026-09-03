import { describe, expect, it, vi, beforeEach } from 'vitest';

// The inbox stored a sent template as its NAME. A thread that had just
// delivered "Hi Sanju, your order #1234 is ready" showed the word
// `order_ready` — the business's copy of the conversation did not match the
// customer's. Meta returns only a message id, so the text has to be rebuilt
// from the approved template plus the parameters the send supplied.
const axiosGet = vi.fn();
const axiosPost = vi.fn();
vi.mock('axios', () => ({
  default: { get: (...args: any[]) => axiosGet(...args), post: (...args: any[]) => axiosPost(...args) },
}));

const messageCreate = vi.fn();
vi.mock('@/lib/models/Message', () => ({
  default: {
    create: (...args: any[]) => messageCreate(...args),
    findOne: () => ({ lean: async () => null }),
  },
}));
vi.mock('@/lib/models/CampaignMessageStatus', () => ({ default: { updateOne: vi.fn() } }));
vi.mock('@/lib/socket/emitter', () => ({ emitNewMessage: vi.fn() }));
vi.mock('@/lib/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { renderTemplateParts, substituteTemplateVariables, findTemplateDefinition } = await import(
  '@/lib/whatsapp/templateContent'
);
const { clearTemplateDefinitionCache, hydrateLegacyTemplateMessages } = await import('@/lib/whatsapp/templates');
const { dispatchTemplateMessage } = await import('@/lib/whatsapp/dispatch');

const ORDER_READY = {
  name: 'order_ready',
  language: 'en_US',
  components: [
    { type: 'HEADER', format: 'TEXT', text: 'Order {{1}}' },
    { type: 'BODY', text: 'Hi {{1}}, your order is ready for pickup.' },
    { type: 'FOOTER', text: 'Reply STOP to opt out' },
    { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Track order' }] },
  ],
};

const SENT_COMPONENTS = [
  { type: 'header', parameters: [{ type: 'text', text: '1234' }] },
  { type: 'body', parameters: [{ type: 'text', text: 'Sanju' }] },
];

const accountContext = {
  account: { _id: 'acct-1' },
  accessToken: 'token',
  graphVersion: 'v20.0',
  phoneNumberId: '15550001111',
  wabaId: 'waba-1',
};

const givenTemplateLookupReturns = (templates: any[]) => {
  axiosGet.mockResolvedValue({ data: { data: templates } });
};

beforeEach(() => {
  vi.clearAllMocks();
  clearTemplateDefinitionCache();
  messageCreate.mockImplementation(async (payload: any) => ({ ...payload, toObject: () => payload }));
  axiosPost.mockResolvedValue({ data: { messages: [{ id: 'wamid.1' }] } });
  givenTemplateLookupReturns([ORDER_READY]);
});

describe('turning a template into the words it delivered', () => {
  it('fills the placeholders from the parameters the send supplied', () => {
    const parts = renderTemplateParts(ORDER_READY, SENT_COMPONENTS);

    expect(parts.header).toBe('Order 1234');
    expect(parts.body).toBe('Hi Sanju, your order is ready for pickup.');
    expect(parts.footer).toBe('Reply STOP to opt out');
    expect(parts.buttons).toEqual(['Track order']);
    expect(parts.text).toBe('Order 1234\n\nHi Sanju, your order is ready for pickup.\n\nReply STOP to opt out');
  });

  it('reads named placeholders as well as numbered ones', () => {
    expect(
      substituteTemplateVariables('Hi {{customer_name}}, order {{order_id}}', [
        { type: 'text', parameter_name: 'customer_name', text: 'Sanju' },
        { type: 'text', parameter_name: 'order_id', text: '1234' },
      ])
    ).toBe('Hi Sanju, order 1234');
  });

  it('shows a placeholder that went unsupplied rather than a silent gap', () => {
    expect(substituteTemplateVariables('Hi {{1}}, order {{2}}', [{ type: 'text', text: 'Sanju' }])).toBe(
      'Hi Sanju, order {{2}}'
    );
  });

  it('uses the fallback value Meta localises currency and dates from', () => {
    expect(
      substituteTemplateVariables('Total {{1}} due {{2}}', [
        { type: 'currency', currency: { fallback_value: '₹1,200.00' } },
        { type: 'date_time', date_time: { fallback_value: '3 Sept' } },
      ])
    ).toBe('Total ₹1,200.00 due 3 Sept');
  });

  it('leaves a media header out of the text, having no words to show', () => {
    const parts = renderTemplateParts(
      { components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'Your receipt' }] },
      [{ type: 'header', parameters: [{ type: 'image', image: { link: 'https://example.com/a.png' } }] }]
    );

    expect(parts.header).toBe('');
    expect(parts.text).toBe('Your receipt');
  });

  it('picks the template copy matching the language that was sent', () => {
    const hindi = { ...ORDER_READY, language: 'hi_IN', components: [{ type: 'BODY', text: 'namaste' }] };

    expect(findTemplateDefinition([hindi, ORDER_READY], 'order_ready', 'en_US')).toBe(ORDER_READY);
    expect(findTemplateDefinition([ORDER_READY, hindi], 'order_ready', 'hi_IN')).toBe(hindi);
  });
});

describe('what a template send stores in the inbox', () => {
  it('stores the rendered message, not the template name', async () => {
    await dispatchTemplateMessage({
      accountContext,
      userId: 'user-1',
      to: '+91 93723 33633',
      templateName: 'order_ready',
      language: 'en_US',
      components: SENT_COMPONENTS,
    });

    const saved = messageCreate.mock.calls[0][0];
    expect(saved.body).toContain('Hi Sanju, your order is ready for pickup.');
    expect(saved.message).toBe(saved.body);
    expect(saved.text).toBe(saved.body);
    expect(saved.body).not.toBe('order_ready');
  });

  it('keeps the template it came from, so a rendered row stays traceable', async () => {
    await dispatchTemplateMessage({
      accountContext,
      userId: 'user-1',
      to: '919372333633',
      templateName: 'order_ready',
      language: 'en_US',
      components: SENT_COMPONENTS,
    });

    const saved = messageCreate.mock.calls[0][0];
    expect(saved.templateName).toBe('order_ready');
    expect(saved.templateLanguage).toBe('en_US');
    expect(saved.templateParts.header).toBe('Order 1234');
    expect(saved.templateParts.buttons).toEqual(['Track order']);
  });

  it('falls back to the template name when the definition cannot be read', async () => {
    axiosGet.mockRejectedValue(new Error('graph is down'));

    await dispatchTemplateMessage({
      accountContext,
      userId: 'user-1',
      to: '919372333633',
      templateName: 'order_ready',
      language: 'en_US',
      components: SENT_COMPONENTS,
    });

    // The send already succeeded; a failed lookup must degrade to the old
    // behaviour, never throw away a delivered message.
    const saved = messageCreate.mock.calls[0][0];
    expect(saved.body).toBe('order_ready');
    expect(saved.templateParts).toBeUndefined();
  });

  it('resolves the template once for a broadcast of the same template', async () => {
    for (const to of ['919372333633', '918956336781', '918007072111']) {
      await dispatchTemplateMessage({
        accountContext,
        userId: 'user-1',
        to,
        templateName: 'order_ready',
        language: 'en_US',
        components: SENT_COMPONENTS,
      });
    }

    expect(axiosPost).toHaveBeenCalledTimes(3);
    expect(axiosGet).toHaveBeenCalledTimes(1);
  });
});

describe('rows saved before sends recorded their text', () => {
  it('renders the template a legacy row names, placeholders and all', async () => {
    const rows = [{ type: 'template', body: 'order_ready', message: 'order_ready', text: 'order_ready' }];

    const [hydrated]: any = await hydrateLegacyTemplateMessages(rows, accountContext);

    expect(hydrated.body).toContain('your order is ready for pickup');
    // The parameters were never recorded, so the variable stays visible rather
    // than being invented or blanked.
    expect(hydrated.body).toContain('{{1}}');
    expect(hydrated.templateName).toBe('order_ready');
  });

  it('leaves a row that already carries real text alone', async () => {
    const rows = [
      { type: 'template', body: 'Hi Sanju, your order is ready.', templateParts: { body: 'Hi Sanju, your order is ready.' } },
      { type: 'text', body: 'order_ready' },
    ];

    const hydrated: any = await hydrateLegacyTemplateMessages(rows, accountContext);

    expect(hydrated[0].body).toBe('Hi Sanju, your order is ready.');
    expect(hydrated[1].body).toBe('order_ready');
    expect(axiosGet).not.toHaveBeenCalled();
  });
});
