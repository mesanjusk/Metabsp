import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import RcsAgent from '@/lib/models/RcsAgent';
import { rcsRuntimeStatus } from '@/lib/rcs/googleRbm';

const REGIONS = new Set(['asia', 'europe', 'us']);
const USE_CASES = new Set(['OTP', 'TRANSACTIONAL', 'PROMOTIONAL', 'MULTI_USE']);
const FALLBACKS = new Set(['none', 'whatsapp', 'sms']);

function publicAgent(agent: any) {
  if (!agent) return null;
  return {
    id: String(agent._id),
    agentId: String(agent.agentId || ''),
    displayName: String(agent.displayName || ''),
    region: String(agent.region || 'asia'),
    useCase: String(agent.useCase || 'MULTI_USE'),
    fallbackMode: String(agent.fallbackMode || 'none'),
    isActive: agent.isActive !== false,
    updatedAt: agent.updatedAt || null,
  };
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const agent: any = await RcsAgent.findOne({ userId: authed.id }).lean();
    const origin = String(process.env.FRONTEND_URL || req.nextUrl.origin).replace(/\/$/, '');

    return NextResponse.json({
      success: true,
      data: {
        agent: publicAgent(agent),
        runtime: rcsRuntimeStatus(),
        webhookUrl: `${origin}/api/rcs/webhook`,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load RCS settings');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json();

    const agentId = String(body?.agentId || '').trim();
    const displayName = String(body?.displayName || '').trim().slice(0, 120);
    const region = String(body?.region || 'asia').toLowerCase();
    const useCase = String(body?.useCase || 'MULTI_USE').toUpperCase();
    const fallbackMode = String(body?.fallbackMode || 'none').toLowerCase();

    if (!agentId) throw new AppError('RCS agent ID is required', 400);
    if (!REGIONS.has(region)) throw new AppError('Invalid RCS hosting region', 400);
    if (!USE_CASES.has(useCase)) throw new AppError('Invalid RCS agent use case', 400);
    if (!FALLBACKS.has(fallbackMode)) throw new AppError('Invalid RCS fallback mode', 400);

    const agent: any = await RcsAgent.findOneAndUpdate(
      { userId: authed.id },
      {
        $set: {
          tenantId: authed.tenantId || null,
          agentId,
          displayName,
          region,
          useCase,
          fallbackMode,
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({ success: true, message: 'RCS agent settings saved', data: publicAgent(agent) });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: 'That RCS agent ID is already assigned to another account.' },
        { status: 409 }
      );
    }
    return errorResponse(error, 'Failed to save RCS settings');
  }
}
