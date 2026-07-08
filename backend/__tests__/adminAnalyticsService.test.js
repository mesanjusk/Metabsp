const Organization = require('../bulk/models/Organization');
const WhatsAppAccount = require('../src/repositories/whatsappAccount');
const Message = require('../src/repositories/Message');
const Subscription = require('../src/models/Subscription');
const Invoice = require('../src/models/Invoice');
const { getAdminOverview } = require('../src/services/adminAnalyticsService');

jest.mock('../bulk/models/Organization', () => ({
  countDocuments: jest.fn(),
  find: jest.fn(),
}));
jest.mock('../src/repositories/whatsappAccount', () => ({
  aggregate: jest.fn(),
}));
jest.mock('../src/repositories/Message', () => ({
  countDocuments: jest.fn(),
}));
jest.mock('../src/models/Subscription', () => ({
  countDocuments: jest.fn(),
}));
jest.mock('../src/models/Invoice', () => ({
  aggregate: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('adminAnalyticsService.getAdminOverview', () => {
  it('aggregates tenant/subscription/revenue counts and ranks tenants by message usage', async () => {
    Organization.countDocuments.mockResolvedValue(5);
    Subscription.countDocuments.mockResolvedValue(3);
    Invoice.aggregate.mockResolvedValue([{ _id: null, total: 199800 }]);
    WhatsAppAccount.aggregate.mockResolvedValue([
      { _id: 'tenant-a', accountIds: ['acc-1'] },
      { _id: 'tenant-b', accountIds: ['acc-2'] },
    ]);
    Message.countDocuments
      .mockResolvedValueOnce(100) // tenant-a
      .mockResolvedValueOnce(500); // tenant-b
    Organization.find.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([
          { _id: 'tenant-a', name: 'Acme A' },
          { _id: 'tenant-b', name: 'Acme B' },
        ]),
      }),
    });

    const overview = await getAdminOverview({ periodStart: new Date('2026-07-01'), periodEnd: new Date('2026-07-31') });

    expect(overview.tenantCount).toBe(5);
    expect(overview.activeSubscriptionCount).toBe(3);
    expect(overview.revenueInPaiseThisPeriod).toBe(199800);
    expect(overview.totalMessagesThisPeriod).toBe(600);
    expect(overview.topTenantsByUsage[0]).toEqual({ tenantId: 'tenant-b', tenantName: 'Acme B', messageCount: 500 });
    expect(overview.topTenantsByUsage[1]).toEqual({ tenantId: 'tenant-a', tenantName: 'Acme A', messageCount: 100 });
  });

  it('handles zero revenue/tenants without throwing', async () => {
    Organization.countDocuments.mockResolvedValue(0);
    Subscription.countDocuments.mockResolvedValue(0);
    Invoice.aggregate.mockResolvedValue([]);
    WhatsAppAccount.aggregate.mockResolvedValue([]);
    Organization.find.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });

    const overview = await getAdminOverview({});

    expect(overview.revenueInPaiseThisPeriod).toBe(0);
    expect(overview.totalMessagesThisPeriod).toBe(0);
    expect(overview.topTenantsByUsage).toEqual([]);
  });

  it('caps the top-tenants list at 10 entries', async () => {
    Organization.countDocuments.mockResolvedValue(20);
    Subscription.countDocuments.mockResolvedValue(20);
    Invoice.aggregate.mockResolvedValue([]);
    const accountsByTenant = Array.from({ length: 15 }, (_, i) => ({ _id: `tenant-${i}`, accountIds: [`acc-${i}`] }));
    WhatsAppAccount.aggregate.mockResolvedValue(accountsByTenant);
    Message.countDocuments.mockResolvedValue(10);
    Organization.find.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve(accountsByTenant.map((t) => ({ _id: t._id, name: t._id }))),
      }),
    });

    const overview = await getAdminOverview({});

    expect(overview.topTenantsByUsage).toHaveLength(10);
  });
});
