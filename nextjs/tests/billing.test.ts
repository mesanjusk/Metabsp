import { describe, expect, it } from 'vitest';
import { computeInvoiceAmounts } from '@/lib/services/billingService';

describe('billing — metered invoice amounts', () => {
  const plan = { priceInPaise: 99900, includedMessages: 1000, overagePricePerMessageInPaise: 25 };

  it('charges the plan price alone when usage is inside the quota', () => {
    expect(computeInvoiceAmounts({ plan, messageCount: 750 })).toEqual({
      overageMessageCount: 0,
      overageAmountInPaise: 0,
      totalAmountInPaise: 99900,
    });
  });

  it('bills only the messages beyond the quota, not all of them', () => {
    expect(computeInvoiceAmounts({ plan, messageCount: 1400 })).toEqual({
      overageMessageCount: 400,
      overageAmountInPaise: 10000,
      totalAmountInPaise: 109900,
    });
  });

  it('treats exactly the quota as no overage', () => {
    expect(computeInvoiceAmounts({ plan, messageCount: 1000 }).overageMessageCount).toBe(0);
  });

  it('never produces a negative overage from a plan with no usage', () => {
    expect(computeInvoiceAmounts({ plan, messageCount: 0 }).overageAmountInPaise).toBe(0);
  });

  it('handles a plan that has no included quota or overage rate configured', () => {
    expect(computeInvoiceAmounts({ plan: { priceInPaise: 50000 }, messageCount: 300 })).toEqual({
      overageMessageCount: 300,
      overageAmountInPaise: 0,
      totalAmountInPaise: 50000,
    });
  });
});
