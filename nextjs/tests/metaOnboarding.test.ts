import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosGet = vi.fn();
vi.mock('axios', () => ({ default: { get: (...args: any[]) => axiosGet(...args) } }));
vi.mock('@/lib/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  validateTokenDebugData,
  extractWabaTargetIdsByScope,
  coveredWabaIds,
  wabaCoveredByAllScopes,
  resolveWabaId,
  fetchWabaPhoneNumbers,
  selectOnboardedPhone,
  isCoexistenceNumber,
  REQUIRED_WHATSAPP_SCOPES,
} from '@/lib/whatsapp/metaOnboarding';

// The Embedded Signup v4 server-side trust boundary: the browser's WABA id,
// phone number id and coexistence flag are all hints, and these functions are
// what re-derive and validate them against Meta before an account is written.

const validDebug = (over: any = {}) => ({
  is_valid: true,
  app_id: 'app-123',
  scopes: [...REQUIRED_WHATSAPP_SCOPES, 'public_profile'],
  granular_scopes: [{ scope: 'whatsapp_business_management', target_ids: ['1001', '1002'] }],
  expires_at: 0,
  ...over,
});

describe('validateTokenDebugData — BISU token validation', () => {
  it('accepts a valid token for this app with the required scopes', () => {
    const result = validateTokenDebugData(validDebug(), { expectedAppId: 'app-123' });
    expect(result.scopes).toEqual(expect.arrayContaining(REQUIRED_WHATSAPP_SCOPES));
    // Only management enumerates targets here; messaging is unrestricted, so
    // both enumerated WABAs are covered.
    expect(result.coveredWabaIds.sort()).toEqual(['1001', '1002']);
    expect(result.expiresAt).toBeNull(); // expires_at 0 => never
  });

  it('translates a non-zero expires_at to a millisecond timestamp', () => {
    const result = validateTokenDebugData(validDebug({ expires_at: 2_000_000_000 }), { expectedAppId: 'app-123' });
    expect(result.expiresAt).toBe(2_000_000_000 * 1000);
  });

  it('REJECTS a token minted for a different Meta app', () => {
    expect(() => validateTokenDebugData(validDebug({ app_id: 'someone-else' }), { expectedAppId: 'app-123' }))
      .toThrow(/different Meta app/i);
  });

  it('REJECTS an invalid token', () => {
    expect(() => validateTokenDebugData(validDebug({ is_valid: false }), { expectedAppId: 'app-123' }))
      .toThrow(/not valid/i);
  });

  it('REJECTS a token missing a required WhatsApp scope', () => {
    expect(() =>
      validateTokenDebugData(validDebug({ scopes: ['whatsapp_business_messaging'] }), { expectedAppId: 'app-123' })
    ).toThrow(/whatsapp_business_management/);
  });
});

describe('extractWabaTargetIdsByScope', () => {
  it('reads WABA ids per WhatsApp scope, ignoring non-WhatsApp scopes', () => {
    const byScope = extractWabaTargetIdsByScope({
      granular_scopes: [
        { scope: 'whatsapp_business_management', target_ids: ['1001'] },
        { scope: 'whatsapp_business_messaging', target_ids: ['1001', '1002'] },
        { scope: 'business_management', target_ids: ['9999'] }, // ignored — not a WhatsApp scope
      ],
    });
    expect(byScope).toEqual({
      whatsapp_business_management: ['1001'],
      whatsapp_business_messaging: ['1001', '1002'],
    });
  });

  it('returns {} when there are no granular scopes', () => {
    expect(extractWabaTargetIdsByScope({})).toEqual({});
  });
});

describe('coveredWabaIds — intersection across required scopes', () => {
  it('intersects when both scopes enumerate targets', () => {
    expect(
      coveredWabaIds({
        whatsapp_business_management: ['1001', '1002'],
        whatsapp_business_messaging: ['1002'],
      })
    ).toEqual(['1002']);
  });

  it('treats an unenumerated required scope as unrestricted', () => {
    expect(coveredWabaIds({ whatsapp_business_management: ['1001'] })).toEqual(['1001']);
  });

  it('is empty when nothing enumerates targets', () => {
    expect(coveredWabaIds({})).toEqual([]);
  });

  it('is empty when the scopes target disjoint WABAs (A vs B)', () => {
    expect(
      coveredWabaIds({
        whatsapp_business_management: ['A'],
        whatsapp_business_messaging: ['B'],
      })
    ).toEqual([]);
  });
});

describe('wabaCoveredByAllScopes', () => {
  it('is false when a required scope enumerates a different WABA', () => {
    expect(
      wabaCoveredByAllScopes('A', {
        whatsapp_business_management: ['A'],
        whatsapp_business_messaging: ['B'],
      })
    ).toBe(false);
  });

  it('is true when every enumerating scope includes it', () => {
    expect(
      wabaCoveredByAllScopes('A', {
        whatsapp_business_management: ['A'],
        whatsapp_business_messaging: ['A', 'B'],
      })
    ).toBe(true);
  });

  it('is true when nothing enumerates (cannot disprove)', () => {
    expect(wabaCoveredByAllScopes('A', {})).toBe(true);
  });
});

describe('resolveWabaId', () => {
  it('trusts a browser-reported id that every required scope confirms', () => {
    expect(
      resolveWabaId({
        reported: '1001',
        wabaTargetIdsByScope: { whatsapp_business_management: ['1001'], whatsapp_business_messaging: ['1001'] },
      })
    ).toBe('1001');
  });

  it('trusts a browser-reported id when the token grants no cross-check', () => {
    expect(resolveWabaId({ reported: '1001', wabaTargetIdsByScope: {} })).toBe('1001');
  });

  it('REJECTS a reported id covered by only one of the two required scopes', () => {
    expect(() =>
      resolveWabaId({
        reported: '1001',
        wabaTargetIdsByScope: { whatsapp_business_management: ['1001'], whatsapp_business_messaging: ['1002'] },
      })
    ).toThrow(/not covered by every required/i);
  });

  it('derives the WABA from the covered set when the browser named none', () => {
    expect(resolveWabaId({ reported: '', wabaTargetIdsByScope: { whatsapp_business_management: ['1001'] } })).toBe('1001');
  });

  it('refuses to guess when several covered WABAs remain and none reported', () => {
    expect(() =>
      resolveWabaId({
        reported: '',
        wabaTargetIdsByScope: { whatsapp_business_management: ['1001', '1002'], whatsapp_business_messaging: ['1001', '1002'] },
      })
    ).toThrow(/reconnect and choose/i);
  });

  it('errors when nothing identifies a WABA', () => {
    expect(() => resolveWabaId({ reported: '', wabaTargetIdsByScope: {} })).toThrow(/Could not determine/i);
  });
});

describe('selectOnboardedPhone — missing phone number id discovery', () => {
  const phone = (id: string, over: any = {}) => ({
    id,
    displayPhoneNumber: `+1${id}`,
    verifiedName: 'Biz',
    platformType: 'CLOUD_API',
    ...over,
  });

  it('honours a browser-reported id present on the WABA', () => {
    const chosen = selectOnboardedPhone({ reported: 'p2', candidates: [phone('p1'), phone('p2')] });
    expect(chosen.id).toBe('p2');
  });

  it('REJECTS a reported id that is not on the WABA (no silent fallback)', () => {
    expect(() => selectOnboardedPhone({ reported: 'nope', candidates: [phone('p1')] })).toThrow(/not part of/i);
  });

  it('uses the only number when the browser reported none (coexistence case)', () => {
    const chosen = selectOnboardedPhone({ reported: '', candidates: [phone('p1', { platformType: 'SMB_APP' })] });
    expect(chosen.id).toBe('p1');
  });

  it('errors precisely when the WABA has no phone numbers', () => {
    expect(() => selectOnboardedPhone({ reported: '', candidates: [] })).toThrow(/no phone numbers/i);
  });

  it('narrows several candidates to a single SMB_APP number under a coexistence hint', () => {
    const chosen = selectOnboardedPhone({
      reported: '',
      coexistenceHint: true,
      candidates: [phone('p1'), phone('p2', { platformType: 'SMB_APP' })],
    });
    expect(chosen.id).toBe('p2');
  });

  it('refuses to pick at random when several numbers remain ambiguous', () => {
    expect(() =>
      selectOnboardedPhone({ reported: '', candidates: [phone('p1'), phone('p2')] })
    ).toThrow(/Several phone numbers/i);
  });
});

describe('isCoexistenceNumber', () => {
  it('is coexistence when the browser said so', () => {
    expect(isCoexistenceNumber({ coexistenceHint: true, platformType: 'CLOUD_API' })).toBe(true);
  });
  it('is coexistence when Meta reports SMB_APP even if the browser did not', () => {
    expect(isCoexistenceNumber({ coexistenceHint: false, platformType: 'SMB_APP' })).toBe(true);
  });
  it('is ordinary Cloud API otherwise', () => {
    expect(isCoexistenceNumber({ coexistenceHint: false, platformType: 'CLOUD_API' })).toBe(false);
  });
});

describe('fetchWabaPhoneNumbers — pagination', () => {
  beforeEach(() => axiosGet.mockReset());

  it('follows paging.next across pages and returns every number', async () => {
    axiosGet
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'p1', display_phone_number: '+1', platform_type: 'CLOUD_API' }],
          paging: { next: 'https://graph.facebook.com/next', cursors: { after: 'CUR1' } },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'p2', display_phone_number: '+2', platform_type: 'SMB_APP' }],
          paging: {}, // no next → stop
        },
      });

    const result = await fetchWabaPhoneNumbers({ wabaId: 'w1', accessToken: 't', graphVersion: 'v23.0' });
    expect(result.map((r) => r.id)).toEqual(['p1', 'p2']);
    expect(axiosGet).toHaveBeenCalledTimes(2);
    // The second call carries the cursor from the first page's paging.
    expect(axiosGet.mock.calls[1][1].params.after).toBe('CUR1');
  });

  it('stops after a single page when there is no next cursor', async () => {
    axiosGet.mockResolvedValueOnce({
      data: { data: [{ id: 'only' }], paging: { cursors: { after: 'X' } } }, // no `next`
    });
    const result = await fetchWabaPhoneNumbers({ wabaId: 'w1', accessToken: 't' });
    expect(result.map((r) => r.id)).toEqual(['only']);
    expect(axiosGet).toHaveBeenCalledTimes(1);
  });
});
