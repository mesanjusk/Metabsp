import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { normalizeWorkflowPayload } from '@/lib/whatsapp/automation';
import AppError from '@/lib/utils/AppError';
import Workflow from '@/lib/models/Workflow';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;
    const payload = normalizeWorkflowPayload(await req.json().catch(() => ({})));

    if (!payload.name) throw new AppError('Workflow name is required', 400);
    if (!payload.keyword) throw new AppError('Trigger keyword is required', 400);
    if (!payload.steps.length) throw new AppError('At least one step is required', 400);

    const workflow = await Workflow.findOneAndUpdate({ _id: id, userId: authed.id }, payload, {
      new: true,
      runValidators: true,
    });
    if (!workflow) throw new AppError('Workflow not found', 404);

    return NextResponse.json({ success: true, data: workflow });
  } catch (error) {
    return errorResponse(error, 'Failed to update workflow');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const deleted = await Workflow.findOneAndDelete({ _id: id, userId: authed.id });
    if (!deleted) throw new AppError('Workflow not found', 404);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to delete workflow');
  }
}
