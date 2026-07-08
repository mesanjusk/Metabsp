const { renderInvoicePdf } = require('../src/services/invoicePdfService');

describe('invoicePdfService.renderInvoicePdf', () => {
  const invoice = {
    invoiceNumber: 'INV-20260708-0001',
    status: 'pending',
    periodStart: new Date('2026-07-01'),
    periodEnd: new Date('2026-07-31'),
    planAmountInPaise: 99900,
    overageMessageCount: 250,
    overageAmountInPaise: 5000,
    totalAmountInPaise: 104900,
  };

  it('produces a real PDF buffer', async () => {
    const buffer = await renderInvoicePdf({ invoice, organization: { name: 'Acme Inc', billingEmail: 'billing@acme.test' } });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('does not throw when there is no overage and no organization given', async () => {
    const buffer = await renderInvoicePdf({
      invoice: { ...invoice, overageMessageCount: 0, overageAmountInPaise: 0 },
      organization: null,
    });

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
