import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import Subscription from '@/lib/models/Subscription';
// Registers the SubscriptionPlan model before populate('planId') looks it up.
import '@/lib/models/SubscriptionPlan';
import { ensureTenantForUser } from '@/lib/services/tenantService';

// Ported from backend/src/routes/billing.js.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const tenantId = await ensureTenantForUser(authed.id);
    const subscription = await Subscription.findOne({ tenantId, status: { $ne: 'canceled' } })
      .sort({ createdAt: -1 })
      .populate('planId')
      .lean();

    return NextResponse.json({ success: true, data: subscription || null });
  } catch (error) {
    return errorResponse(error, 'Failed to load the subscription');
  }
}
