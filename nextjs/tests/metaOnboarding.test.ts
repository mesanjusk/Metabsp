import { describe, expect, it } from 'vitest';
import {
  validateTokenDebugData,
  extractWabaTargetIds,
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
    expect(result.wabaTargetIds).toEqual(['1001', '1002']);
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

describe('extractWabaTargetIds', () => {
  it('reads WABA ids from the WhatsApp granular scopes only', () => {
    const ids = extractWabaTargetIds({
      granular_scopes: [
        { scope: 'whatsapp_business_management', target_ids: ['1001'] },
        { scope: 'whatsapp_business_messaging', target_ids: ['1001', '1002'] },
        { scope: 'business_management', target_ids: ['9999'] }, // ignored — not a WhatsApp scope
      ],
    });
    expect(ids.sort()).toEqual(['1001', '1002']);
  });

  it('returns [] when there are no granular scopes', () => {
    expect(extractWabaTargetIds({})).toEqual([]);
  });
});

describe('resolveWabaId', () => {
  it('trusts a browser-reported id that the token confirms', () => {
    expect(resolveWabaId({ reported: '1001', wabaTargetIds: ['1001', '1002'] })).toBe('1001');
  });

  it('trusts a browser-reported id when the token grants no cross-check', () => {
    expect(resolveWabaId({ reported: '1001', wabaTargetIds: [] })).toBe('1001');
  });

  it('REJECTS a reported id the token does not cover', () => {
    expect(() => resolveWabaId({ reported: '7777', wabaTargetIds: ['1001', '1002'] })).toThrow(/not covered/i);
  });

  it('derives the WABA from the token when the browser named none', () => {
    expect(resolveWabaId({ reported: '', wabaTargetIds: ['1001'] })).toBe('1001');
  });

  it('refuses to guess when several WABAs are granted and none reported', () => {
    expect(() => resolveWabaId({ reported: '', wabaTargetIds: ['1001', '1002'] })).toThrow(/reconnect and choose/i);
  });

  it('errors when nothing identifies a WABA', () => {
    expect(() => resolveWabaId({ reported: '', wabaTargetIds: [] })).toThrow(/Could not determine/i);
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

describe('fetchWabaPhoneNumbers is exported for the route', () => {
  it('is a function', () => {
    expect(typeof fetchWabaPhoneNumbers).toBe('function');
  });
});
