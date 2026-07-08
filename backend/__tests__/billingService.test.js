const { computeInvoiceAmounts } = require('../src/services/billingService');

describe('billingService.computeInvoiceAmounts', () => {
  const plan = { priceInPaise: 99900, includedMessages: 1000, overagePricePerMessageInPaise: 20 };

  it('charges only the plan price when usage is within the included quota', () => {
    const result = computeInvoiceAmounts({ plan, messageCount: 500 });
    expect(result).toEqual({ overageMessageCount: 0, overageAmountInPaise: 0, totalAmountInPaise: 99900 });
  });

  it('charges only the plan price when usage exactly equals the quota', () => {
    const result = computeInvoiceAmounts({ plan, messageCount: 1000 });
    expect(result.overageMessageCount).toBe(0);
    expect(result.totalAmountInPaise).toBe(99900);
  });

  it('adds metered overage above the included quota', () => {
    const result = computeInvoiceAmounts({ plan, messageCount: 1250 });
    expect(result.overageMessageCount).toBe(250);
    expect(result.overageAmountInPaise).toBe(250 * 20);
    expect(result.totalAmountInPaise).toBe(99900 + 250 * 20);
  });

  it('treats a plan with no included quota as fully metered', () => {
    const meteredPlan = { priceInPaise: 0, includedMessages: 0, overagePricePerMessageInPaise: 50 };
    const result = computeInvoiceAmounts({ plan: meteredPlan, messageCount: 100 });
    expect(result).toEqual({ overageMessageCount: 100, overageAmountInPaise: 5000, totalAmountInPaise: 5000 });
  });
});
