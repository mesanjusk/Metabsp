import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import Invoice from '@/lib/models/Invoice';
import { ensureTenantForUser } from '@/lib/services/tenantService';

// Ported from backend/src/routes/billing.js.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const tenantId = await ensureTenantForUser(authed.id);
    const invoices = await Invoice.find({ tenantId }).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ success: true, data: invoices });
  } catch (error) {
    return errorResponse(error, 'Failed to list invoices');
  }
}
