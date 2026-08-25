import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import SubscriptionPlan from '@/lib/models/SubscriptionPlan';

// Ported from backend/src/routes/billing.js.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    await requireAuth(req);

    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ priceInPaise: 1 }).lean();
    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    return errorResponse(error, 'Failed to list plans');
  }
}
