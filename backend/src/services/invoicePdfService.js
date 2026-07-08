const PDFDocument = require('pdfkit');

const formatRupees = (paise) => `Rs. ${(paise / 100).toFixed(2)}`;

// Renders a simple invoice PDF into a Buffer. Kept deliberately plain (no
// logo/branding assets, which would need to be supplied per-deployment) —
// this is the line-item/legal-minimum content, not final visual design.
function renderInvoicePdf({ invoice, organization }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Invoice', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555').text(`Invoice #: ${invoice.invoiceNumber}`, { align: 'right' });
    doc.text(`Status: ${invoice.status}`, { align: 'right' });
    doc.moveDown(1.5);

    doc.fillColor('#000').fontSize(12).text('Billed to:');
    doc.fontSize(11).text(organization?.name || 'Customer');
    if (organization?.billingEmail) doc.text(organization.billingEmail);
    doc.moveDown(1);

    doc.fontSize(11).text(
      `Billing period: ${invoice.periodStart.toISOString().slice(0, 10)} to ${invoice.periodEnd.toISOString().slice(0, 10)}`
    );
    doc.moveDown(1);

    const tableTop = doc.y;
    doc.fontSize(11).text('Description', 50, tableTop);
    doc.text('Amount', 450, tableTop, { width: 100, align: 'right' });
    doc.moveTo(50, tableTop + 18).lineTo(550, tableTop + 18).stroke();

    let y = tableTop + 26;
    doc.text('Plan subscription', 50, y);
    doc.text(formatRupees(invoice.planAmountInPaise), 450, y, { width: 100, align: 'right' });

    if (invoice.overageMessageCount > 0) {
      y += 20;
      doc.text(`Overage: ${invoice.overageMessageCount} messages`, 50, y);
      doc.text(formatRupees(invoice.overageAmountInPaise), 450, y, { width: 100, align: 'right' });
    }

    y += 26;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 10;
    doc.fontSize(12).text('Total', 50, y);
    doc.text(formatRupees(invoice.totalAmountInPaise), 450, y, { width: 100, align: 'right' });

    doc.end();
  });
}

module.exports = { renderInvoicePdf };
