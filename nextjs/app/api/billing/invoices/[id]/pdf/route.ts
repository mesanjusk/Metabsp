import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import Invoice from '@/lib/models/Invoice';
import Organization from '@/lib/models/Organization';
import { ensureTenantForUser } from '@/lib/services/tenantService';
import { renderInvoicePdf } from '@/lib/services/invoicePdfService';

// pdfkit reads font files from disk at runtime, which webpack cannot bundle.
export const runtime = 'nodejs';

/**
 * Downloads one invoice as a PDF. The billing panel has always linked to this;
 * the Next.js port never had it, so the download 404'd.
 *
 * Scoped by tenantId in the query itself, so another tenant's invoice id
 * simply matches nothing rather than being fetched and then checked.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const tenantId = await ensureTenantForUser(authed.id);
    const invoice: any = await Invoice.findOne({ _id: id, tenantId }).lean();
    if (!invoice) throw new AppError('Invoice not found', 404);

    const organization: any = await Organization.findById(tenantId).lean();
    const pdf = await renderInvoicePdf({ invoice, organization });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to render the invoice');
  }
}
