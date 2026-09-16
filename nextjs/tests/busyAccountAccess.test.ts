import { describe, it, expect, vi } from 'vitest';
const findOne = vi.fn();
vi.mock('@/lib/models/WhatsAppAccount', () => ({ default: { findOne } }));
const { loadWhatsAppAccountForUserById } = await import('@/lib/services/whatsappAccountService');
const accountId = 'a'.repeat(24);
describe('pinned integration sender', () => {
  it('requires current ownership or team membership even for an inactive dashboard selection', async () => {
    findOne.mockReturnValue({ lean: async () => ({ _id: accountId, phoneNumberId: 'PN1', accessToken: 'provider-secret', isActive: false }) });
    const account = await loadWhatsAppAccountForUserById('user1', accountId);
    expect(findOne).toHaveBeenCalledWith({ _id: accountId, status: { $ne: 'disconnected' }, $or: [{ userId: 'user1' }, { teamMemberIds: 'user1' }] });
    expect(account.phoneNumberId).toBe('PN1');
  });
  it('rejects inaccessible and disconnected accounts instead of falling back to another sender', async () => {
    findOne.mockReturnValue({ lean: async () => null });
    await expect(loadWhatsAppAccountForUserById('user1', accountId)).rejects.toMatchObject({ statusCode: 403 });
  });
});
