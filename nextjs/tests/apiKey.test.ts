import { describe, expect, it, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

const findOne = vi.fn();
const updateOne = vi.fn(() => Promise.resolve());
const userFindById = vi.fn();

vi.mock('@/lib/models/ApiKey', async () => {
  const actual: any = await vi.importActual('@/lib/models/ApiKey');
  return { ...actual, default: { findOne, updateOne }, hashApiKey: actual.hashApiKey };
});

vi.mock('@/lib/models/User', () => ({
  default: { findById: (...args: any[]) => userFindById(...args) },
}));

const { requireApiKey } = await import('@/lib/auth/apiKey');
const { ApiKey, hashApiKey } = await import('@/lib/models/ApiKey');

const request = (headers: Record<string, string> = {}) =>
  new NextRequest('https://example.test/api/v1/status', { headers });

const lean = (value: any) => ({ select: () => ({ lean: async () => value }) });

describe('API key authentication', () => {
  beforeEach(() => {
    findOne.mockReset();
    updateOne.mockClear();
    userFindById.mockReset().mockReturnValue(lean({ tenantId: 'tenant-1', isActive: true }));
  });

  it('creates hashed keys while filling the historical key slot with a non-authenticating marker', async () => {
    const create = vi.fn(async (value: any) => value);

    const { doc, rawKey } = await (ApiKey as any).generate.call({ create }, 'user-new', 'Orders');
    const stored = create.mock.calls[0][0];

    expect(rawKey).toMatch(/^mbsp_/);
    expect(stored.keyHash).toBe(hashApiKey(rawKey));
    expect(stored.keyPrefix).toBe(rawKey.slice(0, 12));
    expect(stored.key).toMatch(/^__mbsp_hashed__:/);
    expect(stored.key).not.toBe(rawKey);
    expect(stored.userId).toBe('user-new');
    expect(stored.name).toBe('Orders');
    expect(doc).toBe(stored);
  });

  it('rejects a request with no key', async () => {
    await expect(requireApiKey(request())).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a key whose owner no longer exists', async () => {
    // The account-deletion path revokes keys, but this is the check that holds
    // however the user went: requireApiKey resolves the key record first, and
    // shared accounts are reached through teamMemberIds — so a surviving key
    // on a deleted user could keep sending on somebody else's number.
    const rawKey = 'mbsp_' + crypto.randomBytes(28).toString('hex');
    findOne.mockResolvedValue({ _id: 'key-1', userId: 'deleted-user', keyHash: hashApiKey(rawKey), isActive: true });
    userFindById.mockReturnValue(lean(null));

    await expect(requireApiKey(request({ authorization: `Bearer ${rawKey}` }))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('rejects an unknown key', async () => {
    findOne.mockResolvedValue(null);
    await expect(requireApiKey(request({ authorization: 'Bearer mbsp_nope' }))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('looks a key up by its hash, never by the plaintext', async () => {
    const rawKey = 'mbsp_' + crypto.randomBytes(28).toString('hex');
    findOne.mockResolvedValue({ _id: 'k1', userId: 'u1' });

    const principal = await requireApiKey(request({ authorization: `Bearer ${rawKey}` }));

    expect(findOne).toHaveBeenCalledWith({ keyHash: hashApiKey(rawKey), isActive: true });
    // The plaintext must not appear in any query this made.
    expect(JSON.stringify(findOne.mock.calls)).not.toContain(rawKey);
    expect(principal).toMatchObject({ userId: 'u1', tenantId: 'tenant-1', apiKeyId: 'k1' });
  });

  it('accepts the legacy X-Api-Key header as well as a bearer token', async () => {
    findOne.mockResolvedValue({ _id: 'k2', userId: 'u2' });
    const principal = await requireApiKey(request({ 'x-api-key': 'mbsp_legacy_header' }));
    expect(principal.userId).toBe('u2');
  });

  it('upgrades a pre-hashing plaintext key and replaces plaintext with a retired marker', async () => {
    const rawKey = 'mbsp_older_key_stored_in_plaintext';
    const save = vi.fn(async () => undefined);
    const legacyRow: any = { _id: 'k3', userId: 'u3', key: rawKey, save };

    findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(legacyRow);

    await requireApiKey(request({ authorization: `Bearer ${rawKey}` }));

    expect(legacyRow.keyHash).toBe(hashApiKey(rawKey));
    expect(legacyRow.keyPrefix).toBe(rawKey.slice(0, 12));
    expect(legacyRow.key).toMatch(/^__mbsp_hashed__:/);
    expect(legacyRow.key).not.toBe(rawKey);
    expect(save).toHaveBeenCalled();
  });

  it('never accepts a retired hashed-row marker through the legacy plaintext fallback', async () => {
    const retiredMarker = '__mbsp_hashed__:copied-from-database';
    findOne.mockResolvedValue(null);

    await expect(requireApiKey(request({ authorization: `Bearer ${retiredMarker}` }))).rejects.toMatchObject({
      statusCode: 401,
    });

    // Only the hash lookup runs. There must be no `{ key: retiredMarker }`
    // fallback or the compatibility marker would itself become a credential.
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith({ keyHash: hashApiKey(retiredMarker), isActive: true });
  });

  it('refuses a key whose owning account has been deactivated', async () => {
    findOne.mockResolvedValue({ _id: 'k4', userId: 'u4' });
    userFindById.mockReturnValue(lean({ tenantId: 't', isActive: false }));

    await expect(requireApiKey(request({ authorization: 'Bearer mbsp_any' }))).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
