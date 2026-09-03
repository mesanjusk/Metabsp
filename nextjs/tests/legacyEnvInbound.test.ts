import { describe, expect, it, vi, beforeEach } from 'vitest';

// The asymmetry this file exists for.
//
// Sending has always fallen back to WHATSAPP_ACCESS_TOKEN /
// WHATSAPP_PHONE_NUMBER_ID for a SUPER_ADMIN with no account row. Receiving
// never did. On a deployment configured that way — or on one whose account
// rows were deleted while debugging the inbox — templates go out perfectly
// and every inbound message resolves to no account, is saved with no owner,
// and is shown to nobody. Which is indistinguishable, from the outside, from
// Meta not delivering at all.
const findOne = vi.fn();
const userFindOne = vi.fn();

vi.mock('@/lib/models/WhatsAppAccount', () => ({
  default: { findOne: (...args: any[]) => findOne(...args), find: vi.fn() },
}));
vi.mock('@/lib/models/User', () => ({ default: { findOne: (...args: any[]) => userFindOne(...args) } }));
vi.mock('@/lib/utils/crypto', () => ({ decryptSensitiveValue: () => 'decrypted-token' }));

const { loadWhatsAppAccountFromWebhookIdentifiers, resolveLegacyEnvWebhookContext } = await import(
  '@/lib/services/whatsappAccountService'
);

const PHONE_NUMBER_ID = '912271725313129';
const REAL_WABA = '901077812889176';
const OWNER_ID = 'super-admin-1';

// Both models are queried through chains, and neither chain is the same shape.
const noAccountRows = () => {
  findOne.mockReturnValue({ sort: () => ({ lean: async () => null }) });
};
const givenSuperAdmin = (owner: any) => {
  userFindOne.mockReturnValue({ select: () => ({ sort: () => ({ lean: async () => owner }) }) });
};

beforeEach(() => {
  vi.clearAllMocks();
  noAccountRows();
  givenSuperAdmin({ _id: OWNER_ID });
  process.env.WHATSAPP_ACCESS_TOKEN = 'env-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_WABA_ID;
  delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  delete process.env.WABA_ID;
});

describe('inbound messages when the number is configured only in the environment', () => {
  it('gives the message an owner so it can appear in an inbox', async () => {
    const context: any = await loadWhatsAppAccountFromWebhookIdentifiers(
      { phoneNumberId: PHONE_NUMBER_ID },
      { requireAccount: false }
    );

    expect(context?.account?.userId).toBe(OWNER_ID);
    // Every inbox query is scoped by userId or whatsappAccountId. There is no
    // account row here, so the userId is the whole of what makes it visible.
    expect(context?.account?._id).toBeNull();
  });

  it('carries the token, so inbound media can still be fetched', async () => {
    const context: any = await loadWhatsAppAccountFromWebhookIdentifiers(
      { phoneNumberId: PHONE_NUMBER_ID },
      { requireAccount: false }
    );

    expect(context?.accessToken).toBe('env-token');
  });

  it('matches on the WABA id when the env names one', async () => {
    process.env.WHATSAPP_WABA_ID = REAL_WABA;

    const context: any = await loadWhatsAppAccountFromWebhookIdentifiers(
      { wabaId: REAL_WABA },
      { requireAccount: false }
    );

    expect(context?.account?.userId).toBe(OWNER_ID);
  });

  it('does not claim a number the environment says nothing about', async () => {
    // A second tenant's traffic must not be handed to this deployment's
    // super admin just because we have env vars set.
    const context = await loadWhatsAppAccountFromWebhookIdentifiers(
      { phoneNumberId: '999999999999999' },
      { requireAccount: false }
    );

    expect(context).toBeNull();
  });

  it('stays out of the way when a real account row matches', async () => {
    findOne.mockReturnValue({
      sort: () => ({
        lean: async () => ({ _id: 'acct-1', userId: 'user-1', phoneNumberId: PHONE_NUMBER_ID, accessTokenEncrypted: 'cipher' }),
      }),
    });

    const context: any = await loadWhatsAppAccountFromWebhookIdentifiers(
      { phoneNumberId: PHONE_NUMBER_ID },
      { requireAccount: false }
    );

    expect(context.source).toBe('database');
    expect(context.account._id).toBe('acct-1');
  });
});

describe('the fallback refuses rather than guessing', () => {
  it('does nothing when the environment is not configured for WhatsApp', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    await expect(resolveLegacyEnvWebhookContext({ phoneNumberId: PHONE_NUMBER_ID })).resolves.toBeNull();
  });

  it('does nothing when there is no super admin to own the message', async () => {
    // Saving it against nobody is what the old code already did; inventing an
    // owner would be worse than leaving the existing error log to fire.
    givenSuperAdmin(null);

    await expect(resolveLegacyEnvWebhookContext({ phoneNumberId: PHONE_NUMBER_ID })).resolves.toBeNull();
  });

  it('will not match on an empty identifier', async () => {
    // An envelope with no phone_number_id must not match an env var that is
    // also empty-ish, or the fallback would claim everything.
    process.env.WHATSAPP_WABA_ID = '';

    await expect(resolveLegacyEnvWebhookContext({ phoneNumberId: '', wabaId: '' })).resolves.toBeNull();
  });
});
