import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import RcsAgent from '@/lib/models/RcsAgent';
import { checkRcsCapabilities } from '@/lib/rcs/googleRbm';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json();
    const agent: any = await RcsAgent.findOne({ userId: authed.id, isActive: true }).lean();
    if (!agent) throw new AppError('Configure your RCS agent first', 409);

    const data = await checkRcsCapabilities({
      agentId: String(agent.agentId),
      region: agent.region,
      phone: body?.phone,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'RCS capability check failed');
  }
}
