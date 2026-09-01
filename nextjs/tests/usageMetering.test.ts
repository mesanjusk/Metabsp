import { describe, expect, it, vi } from 'vitest';

const accountFind = vi.fn();
const countDocuments = vi.fn(async (_filter?: any) => 42);

vi.mock('@/lib/models/WhatsAppAccount', () => ({ default: { find: (...a: any[]) => accountFind(...a) } }));
vi.mock('@/lib/models/Message', () => ({ default: { countDocuments } }));

const { getMessageUsageForTenant } = await import('@/lib/services/usageMeteringService');

const period = { periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-02-01') };

describe('usage metering', () => {
  it('returns zero without querying messages when a tenant has no numbers', async () => {
    accountFind.mockReturnValue({ select: () => ({ lean: async () => [] }) });

    expect(await getMessageUsageForTenant('tenant-1', period)).toEqual({ messageCount: 0, accountCount: 0 });
    expect(countDocuments).not.toHaveBeenCalled();
  });

  it('counts outbound messages using the lowercase direction the app actually writes', async () => {
    // The Express original queried direction:'OUTGOING' in caps while every
    // write path stores 'outgoing'. That matched nothing, so metered overage
    // was always zero and no customer was ever billed for it.
    accountFind.mockReturnValue({ select: () => ({ lean: async () => [{ _id: 'a1' }, { _id: 'a2' }] }) });

    const result = await getMessageUsageForTenant('tenant-1', period);

    const filter = countDocuments.mock.calls.at(-1)?.[0] as any;
    expect(filter.$or).toContainEqual({ direction: { $in: ['outgoing', 'OUTGOING'] } });
    expect(filter.whatsappAccountId).toEqual({ $in: ['a1', 'a2'] });
    expect(filter.createdAt).toEqual({ $gte: period.periodStart, $lt: period.periodEnd });
    expect(result).toEqual({ messageCount: 42, accountCount: 2 });
  });
});
