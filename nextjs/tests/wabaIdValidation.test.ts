import { describe, expect, it, vi, beforeEach } from 'vitest';

// The three ids a person copies out of the Meta App Dashboard — App ID,
// business portfolio id, WABA id — are the same shape and sit next to each
// other on screen. Only one of them has a `subscribed_apps` edge, and storing
// either of the others costs every inbound message with no error anywhere:
// sends keep working, because those go to /{phone_number_id}/messages.
const axiosGet = vi.fn();
vi.mock('axios', () => ({ default: { get: (...args: any[]) => axiosGet(...args) } }));

const { validateManualWhatsAppCredentials, assertIsWhatsAppBusinessAccount, resolveWabaIdsFromToken } = await import(
  '@/lib/services/whatsappCredentialValidationService'
);

const APP_ID = '1717826239505344';
const REAL_WABA = '901077812889176';
const PHONE_NUMBER_ID = '912271725313129';

// Meta's exact answer when the node is an App rather than a WABA.
const notAWabaError = () =>
  Object.assign(new Error('Request failed'), {
    response: { data: { error: { code: 100, message: '(#100) Tried accessing nonexisting field (subscribed_apps) on node type (Application)' } } },
  });

const routeGraph = ({
  tokenWabas = [REAL_WABA],
  wabaNodes = [REAL_WABA],
}: { tokenWabas?: string[]; wabaNodes?: string[] } = {}) => {
  axiosGet.mockImplementation(async (url: string) => {
    if (url.endsWith('/me')) return { data: { id: 'meta-user-1', name: 'Tester' } };
    if (url.includes('/debug_token')) {
      return {
        data: { data: { granular_scopes: [{ scope: 'whatsapp_business_messaging', target_ids: tokenWabas }] } },
      };
    }
    if (url.includes('/subscribed_apps')) {
      const id = url.split('/').slice(-2)[0];
      if (wabaNodes.includes(id)) return { data: { data: [] } };
      throw notAWabaError();
    }
    if (url.includes(PHONE_NUMBER_ID)) {
      return { data: { id: PHONE_NUMBER_ID, display_phone_number: '+91 22717 25313', verified_name: 'SanjuSK' } };
    }
    return { data: {} };
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_APP_ID = APP_ID;
  process.env.META_APP_SECRET = 'app-secret';
});

describe('is this id actually a WhatsApp Business Account', () => {
  it('accepts a node that answers subscribed_apps', async () => {
    routeGraph();
    await expect(
      assertIsWhatsAppBusinessAccount({ id: REAL_WABA, accessToken: 't', graphVersion: 'v23.0' })
    ).resolves.toEqual({ verified: true });
  });

  it('refuses an App ID, and says which id to look for instead', async () => {
    routeGraph();
    await expect(
      assertIsWhatsAppBusinessAccount({ id: APP_ID, accessToken: 't', graphVersion: 'v23.0' })
    ).rejects.toThrow(/not a WhatsApp Business Account/);
  });

  it('leaves the question open on an error that is not about the node type', async () => {
    // A permission gap or a rate limit says nothing about whether the id is a
    // WABA. Refusing the connection over it would be worse than proceeding
    // with the doubt recorded.
    axiosGet.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), {
        response: { data: { error: { code: 4, message: 'Application request limit reached' } } },
      })
    );

    const result = await assertIsWhatsAppBusinessAccount({ id: REAL_WABA, accessToken: 't', graphVersion: 'v23.0' });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain('request limit');
  });
});

describe('resolving the WABA from the token instead of from typed input', () => {
  it('reads the WABAs the token is scoped to', async () => {
    routeGraph({ tokenWabas: [REAL_WABA, '222'] });
    await expect(resolveWabaIdsFromToken({ accessToken: 't', graphVersion: 'v23.0' })).resolves.toEqual([
      REAL_WABA,
      '222',
    ]);
  });

  it('returns nothing rather than failing when the app credentials are absent', async () => {
    delete process.env.META_APP_SECRET;
    delete process.env.WHATSAPP_APP_SECRET;
    await expect(resolveWabaIdsFromToken({ accessToken: 't', graphVersion: 'v23.0' })).resolves.toEqual([]);
  });
});

describe('manual connect — the App ID cannot get stored as the WABA', () => {
  it('rejects the exact mistake that cost a deployment every inbound message', async () => {
    routeGraph({ tokenWabas: [REAL_WABA] });

    await expect(
      validateManualWhatsAppCredentials({ accessToken: 't', phoneNumberId: PHONE_NUMBER_ID, wabaId: APP_ID })
    ).rejects.toThrow(/not one of the WhatsApp Business Accounts this access token is scoped to/);
  });

  it('still rejects it when the token scopes cannot be read at all', async () => {
    // No cross-check available — this is the path the old code had, where the
    // typed value went straight through unexamined.
    routeGraph({ tokenWabas: [] });

    await expect(
      validateManualWhatsAppCredentials({ accessToken: 't', phoneNumberId: PHONE_NUMBER_ID, wabaId: APP_ID })
    ).rejects.toThrow(/not a WhatsApp Business Account/);
  });

  it('fills in the WABA from the token when none was typed', async () => {
    routeGraph({ tokenWabas: [REAL_WABA] });

    const result = await validateManualWhatsAppCredentials({
      accessToken: 't',
      phoneNumberId: PHONE_NUMBER_ID,
      businessAccountId: '4373823022847276',
    });

    expect(result.wabaId).toBe(REAL_WABA);
    expect(result.metadata.wabaIdVerified).toBe(true);
  });

  it('accepts a correct WABA id and records that it was verified', async () => {
    routeGraph({ tokenWabas: [REAL_WABA] });

    const result = await validateManualWhatsAppCredentials({
      accessToken: 't',
      phoneNumberId: PHONE_NUMBER_ID,
      wabaId: REAL_WABA,
    });

    expect(result.wabaId).toBe(REAL_WABA);
    expect(result.metadata.tokenWabaIds).toEqual([REAL_WABA]);
  });
});
