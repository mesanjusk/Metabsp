import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { normalizeWorkflowPayload } from '@/lib/whatsapp/automation';
import AppError from '@/lib/utils/AppError';
import Workflow from '@/lib/models/Workflow';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });

    const data = await Workflow.find({
      userId: authed.id,
      ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}),
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to load workflows');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });
    const payload = normalizeWorkflowPayload(await req.json().catch(() => ({})));

    if (!payload.name) throw new AppError('Workflow name is required', 400);
    if (!payload.keyword) throw new AppError('Trigger keyword is required', 400);
    if (!payload.steps.length) throw new AppError('At least one step is required', 400);

    const workflow = await Workflow.create({
      ...payload,
      userId: authed.id,
      whatsappAccountId: accountContext?.account?._id,
    });

    return NextResponse.json({ success: true, data: workflow }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create workflow');
  }
}
