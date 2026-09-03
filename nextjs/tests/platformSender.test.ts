import { describe, expect, it, vi, beforeEach } from 'vitest';

// Signup and password-reset codes belong to no tenant, so they send from the
// platform's own number. That number lived in Render's environment AND in the
// dashboard at once — and two copies of a credential is one copy too many:
// correcting the dashboard changed nothing that read the environment, and the
// two halves disagreed silently while every screen looked right.
const accountFindOne = vi.fn();
const userFindOne = vi.fn();

vi.mock('@/lib/models/WhatsAppAccount', () => ({
  default: { findOne: (...args: any[]) => accountFindOne(...args), find: vi.fn() },
}));
vi.mock('@/lib/models/User', () => ({
  default: { findOne: (...args: any[]) => userFindOne(...args), findById: vi.fn() },
}));
vi.mock('@/lib/utils/crypto', () => ({ decryptSensitiveValue: () => 'account-token' }));

const warn = vi.fn();
vi.mock('@/lib/utils/logger', () => ({ default: { info: vi.fn(), warn, error: vi.fn(), debug: vi.fn() } }));

const { loadPlatformSenderAccount } = await import('@/lib/services/whatsappAccountService');

const ADMIN_ID = 'super-admin-1';
const DASHBOARD_NUMBER = '912271725313129';
const ENV_NUMBER = '999999999999999';

const givenSuperAdmin = (owner: any) => {
  userFindOne.mockReturnValue({ select: () => ({ sort: () => ({ lean: async () => owner }) }) });
};
const givenAdminAccount = (account: any) => {
  accountFindOne.mockReturnValue({ sort: () => ({ lean: async () => account }) });
};

beforeEach(() => {
  vi.clearAllMocks();
  givenSuperAdmin({ _id: ADMIN_ID });
  givenAdminAccount({ _id: 'acct-1', userId: ADMIN_ID, phoneNumberId: DASHBOARD_NUMBER, accessTokenEncrypted: 'cipher' });
  process.env.WHATSAPP_ACCESS_TOKEN = 'env-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = ENV_NUMBER;
});

describe('which number the platform sends its own messages from', () => {
  it('uses the account connected in the dashboard, not the environment copy', async () => {
    const sender: any = await loadPlatformSenderAccount();

    expect(sender.phoneNumberId).toBe(DASHBOARD_NUMBER);
    expect(sender.accessToken).toBe('account-token');
    expect(sender.source).toBe('database');
  });

  it('prefers the dashboard even while both are configured', async () => {
    // The state that made the outage unreadable: both set, disagreeing, with
    // no screen showing which one was winning.
    const sender: any = await loadPlatformSenderAccount();
    expect(sender.phoneNumberId).not.toBe(ENV_NUMBER);
  });

  it('still sends from the environment when no account is connected yet', async () => {
    // Blanking the Render variables must not be able to take signup down on
    // its own, so this path survives — but it is deprecated.
    givenAdminAccount(null);

    const sender: any = await loadPlatformSenderAccount();

    expect(sender.phoneNumberId).toBe(ENV_NUMBER);
    expect(sender.source).toBe('legacy-env');
  });

  it('says so in the log when it falls back, since that copy is uneditable', async () => {
    givenAdminAccount(null);
    await loadPlatformSenderAccount();

    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain('WHATSAPP_ACCESS_TOKEN');
  });

  it('returns nothing rather than guessing when neither is configured', async () => {
    // The caller turns this into a message naming the screen to fix it on.
    // Picking some other tenant's number would send the platform's own OTP
    // from a customer's WhatsApp.
    givenAdminAccount(null);
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;

    await expect(loadPlatformSenderAccount()).resolves.toBeNull();
  });

  it('does not fall back to the environment when there is no super admin', async () => {
    givenSuperAdmin(null);
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    await expect(loadPlatformSenderAccount()).resolves.toBeNull();
  });

  it('ignores an account row whose token could not be resolved', async () => {
    // A row with no usable token would produce a 401 from Meta and an OTP
    // that never arrives; the environment copy is the better answer.
    givenAdminAccount({ _id: 'acct-1', userId: ADMIN_ID, phoneNumberId: DASHBOARD_NUMBER });

    const sender: any = await loadPlatformSenderAccount();
    expect(sender.source).toBe('legacy-env');
  });
});
