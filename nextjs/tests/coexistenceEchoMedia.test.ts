import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Media the business sends from the WhatsApp Business app or WhatsApp Web.
 *
 * Those arrive as `smb_message_echoes`, and an echo carries a media id, never
 * the file — the picture lives behind the Graph API. The inbound path mirrors
 * such media to Cloudinary and records the URL; the echo path did not, so
 * `mediaUrl` stayed empty forever and every consumer (the shared inbox, the
 * /api/v1/messages API) fell back to the message body, which for an uncaptioned
 * image is the raw media id. Customers saw "1025465337202603" where a photo
 * should be, and only for pictures they had sent themselves.
 *
 * The enabling bug was one line up the stack: the coexistence account lookup
 * returned `context.account` and dropped the decrypted `accessToken` with it,
 * so the token needed to fetch the media never reached this code.
 */

const emitNewMessage = vi.fn();
const messageCreate = vi.fn(async (payload: any) => ({
  ...payload,
  _id: 'msg-1',
  toObject: () => payload,
}));
const messageFindOne = vi.fn(() => ({ lean: async () => null }));
const messageFindByIdAndUpdate = vi.fn(async () => ({}));
const uploadWhatsAppMediaToCloudinary = vi.fn(async () => ({
  mediaUrl: 'https://res.cloudinary.com/demo/image/upload/echo.jpg',
  mediaPublicId: 'whatsapp_media/echo',
  mediaResourceType: 'image',
  mimeType: 'image/jpeg',
}));

// What parseIncoming reports for the echo under test.
let parsed = { type: 'image', message: 'media-abc', mediaId: 'media-abc', interactiveId: '' };
// What the webhook identifiers resolve to, token included.
let accountContext: any = {
  account: { _id: 'acct-1', userId: 'user-1' },
  accessToken: 'tok-live',
};

vi.mock('@/lib/socket/emitter', () => ({
  emitNewMessage,
  emitHistorySyncProgress: vi.fn(),
  emitMessageStatus: vi.fn(),
}));

vi.mock('@/lib/models/Message', () => ({
  default: {
    create: messageCreate,
    findOne: messageFindOne,
    findByIdAndUpdate: messageFindByIdAndUpdate,
  },
}));

vi.mock('@/lib/models/Contact', () => ({
  default: { findOneAndUpdate: vi.fn(async () => ({})), updateOne: vi.fn(async () => ({})) },
}));

vi.mock('@/lib/models/WhatsAppAccount', () => ({ default: { updateOne: vi.fn(async () => ({})) } }));
vi.mock('@/lib/models/CampaignMessageStatus', () => ({ default: {} }));

vi.mock('@/lib/services/whatsappAccountService', () => ({
  loadWhatsAppAccountFromWebhookIdentifiers: vi.fn(async () => accountContext),
}));

vi.mock('@/lib/services/whatsappMediaService', () => ({ uploadWhatsAppMediaToCloudinary }));
vi.mock('@/lib/config/graphApi', () => ({
  getGraphApiVersion: () => 'v19.0',
  getWebhookVerifyToken: () => 'verify',
}));

vi.mock('@/lib/whatsapp/webhookProcessing', () => ({
  parseIncoming: () => parsed,
  forwardToWebhookDestinations: vi.fn(async () => undefined),
}));

const { processEchoes, processHistoryChunks } = await import('@/lib/whatsapp/coexistence');

const echoOf = (message: any) => [
  {
    phoneNumberId: 'pn-1',
    displayPhoneNumber: '919876500000',
    wabaId: 'waba-1',
    businessAccountId: 'waba-1',
    message,
  },
];

beforeEach(() => {
  emitNewMessage.mockClear();
  messageCreate.mockClear();
  messageFindByIdAndUpdate.mockClear();
  uploadWhatsAppMediaToCloudinary.mockClear();
  parsed = { type: 'image', message: 'media-abc', mediaId: 'media-abc', interactiveId: '' };
  accountContext = { account: { _id: 'acct-1', userId: 'user-1' }, accessToken: 'tok-live' };
});

describe('coexistence — echoed media', () => {
  it('mirrors an echoed image and records the URL on the message', async () => {
    await processEchoes(echoOf({ id: 'wamid.echo-1', type: 'image', to: '919999999999' }) as any);

    expect(uploadWhatsAppMediaToCloudinary).toHaveBeenCalledWith(
      expect.objectContaining({ mediaId: 'media-abc', accessToken: 'tok-live' })
    );
    expect(messageFindByIdAndUpdate).toHaveBeenCalledWith(
      'msg-1',
      expect.objectContaining({
        $set: expect.objectContaining({
          mediaUrl: 'https://res.cloudinary.com/demo/image/upload/echo.jpg',
          mimeType: 'image/jpeg',
        }),
      })
    );
  });

  it('leaves a text echo alone', async () => {
    parsed = { type: 'text', message: 'on my way', mediaId: '', interactiveId: '' };

    await processEchoes(echoOf({ id: 'wamid.echo-2', type: 'text', to: '919999999999' }) as any);

    expect(uploadWhatsAppMediaToCloudinary).not.toHaveBeenCalled();
    expect(messageFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('skips media when the account has no usable token rather than throwing', async () => {
    accountContext = { account: { _id: 'acct-1', userId: 'user-1' } };

    await processEchoes(echoOf({ id: 'wamid.echo-3', type: 'image', to: '919999999999' }) as any);

    expect(uploadWhatsAppMediaToCloudinary).not.toHaveBeenCalled();
    // The message itself is still stored — media is the bonus, not the point.
    expect(messageCreate).toHaveBeenCalledTimes(1);
  });

  it('keeps the message when mirroring fails', async () => {
    uploadWhatsAppMediaToCloudinary.mockRejectedValueOnce(new Error('graph 404: media expired'));

    await processEchoes(echoOf({ id: 'wamid.echo-4', type: 'image', to: '919999999999' }) as any);

    expect(messageCreate).toHaveBeenCalledTimes(1);
    expect(messageFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('does not fetch media for a history backfill', async () => {
    // Up to 180 days of already-delivered chat: those media ids are long
    // expired at Meta, and one Graph call per message would turn an import
    // into thousands of them.
    await processHistoryChunks([
      {
        phoneNumberId: 'pn-1',
        displayPhoneNumber: '919876500000',
        wabaId: 'waba-1',
        businessAccountId: 'waba-1',
        threads: [{ id: '919999999999', messages: [{ id: 'wamid.hist-1', type: 'image' }] }],
        metadata: { progress: 100 },
      },
    ] as any);

    expect(messageCreate).toHaveBeenCalledTimes(1);
    expect(uploadWhatsAppMediaToCloudinary).not.toHaveBeenCalled();
  });
});
